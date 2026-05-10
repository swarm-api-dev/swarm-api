import "dotenv/config";
import { randomUUID } from "node:crypto";
import path from "node:path";
import express, { type Request, type Response } from "express";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { HTTPFacilitatorClient, type RoutesConfig } from "@x402/core/server";
import { createCdpAuthHeaders } from "./cdp-auth";
import { createDb, ensureSchema, endpoints, payments, upsertEndpoint } from "@swarmapi/db";
import { desc, sql } from "drizzle-orm";
import {
  extractFiling,
  fetchPackageInfo,
  fetchRepoSnapshot,
  listFilings,
  listInsiderTransactions,
  listJobs,
  listNews,
  resolveCompany,
  UpstreamError,
  webSearch,
  type AtsProvider,
  type PackageRegistry,
} from "@swarmapi/company-intel";

const PORT = Number(process.env.PORT ?? 3000);
const PLACEHOLDER_PAY_TO = "0x0000000000000000000000000000000000000001";
const PAY_TO_ADDRESS = process.env.PAY_TO_ADDRESS ?? PLACEHOLDER_PAY_TO;

type NetworkProfile = "base-mainnet" | "base-sepolia";
const NETWORK_PROFILES: Record<
  NetworkProfile,
  {
    network: string;
    usdc: string;
    facilitator: string;
    facilitatorFallback?: string;
    label: string;
  }
> = {
  "base-mainnet": {
    network: "eip155:8453",
    usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    facilitator: "https://api.cdp.coinbase.com/platform/v2/x402",
    facilitatorFallback: "https://facilitator.payai.network",
    label: "Base mainnet",
  },
  "base-sepolia": {
    network: "eip155:84532",
    usdc: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    facilitator: "https://x402.org/facilitator",
    label: "Base Sepolia",
  },
};
const PROFILE = (process.env.NETWORK_PROFILE as NetworkProfile) ?? "base-mainnet";
if (!(PROFILE in NETWORK_PROFILES)) {
  throw new Error(
    `Unknown NETWORK_PROFILE "${PROFILE}". Use "base-mainnet" or "base-sepolia".`,
  );
}
const PROFILE_CFG = NETWORK_PROFILES[PROFILE];
const NETWORK = PROFILE_CFG.network;
const USDC_ASSET = PROFILE_CFG.usdc;

const CDP_API_KEY_NAME = process.env.CDP_API_KEY_NAME ?? "";
const CDP_API_KEY_SECRET = process.env.CDP_API_KEY_SECRET ?? "";

const cdpCredsAvailable = Boolean(CDP_API_KEY_NAME && CDP_API_KEY_SECRET);
let resolvedFacilitatorUrl = process.env.FACILITATOR_URL ?? PROFILE_CFG.facilitator;
let facilitatorAuth: ReturnType<typeof createCdpAuthHeaders> | undefined;

if (resolvedFacilitatorUrl.includes("api.cdp.coinbase.com")) {
  if (cdpCredsAvailable) {
    facilitatorAuth = createCdpAuthHeaders(resolvedFacilitatorUrl, {
      name: CDP_API_KEY_NAME,
      secret: CDP_API_KEY_SECRET,
    });
  } else if (PROFILE_CFG.facilitatorFallback) {
    console.warn(
      `[gateway] CDP facilitator selected but CDP_API_KEY_NAME / CDP_API_KEY_SECRET are unset.\n` +
        `[gateway] Falling back to ${PROFILE_CFG.facilitatorFallback}. ` +
        `Set both env vars to use the CDP facilitator.`,
    );
    resolvedFacilitatorUrl = PROFILE_CFG.facilitatorFallback;
  } else {
    console.warn(
      `[gateway] CDP facilitator selected but credentials are not configured. ` +
        `verify/settle/supported calls WILL fail until CDP_API_KEY_NAME and CDP_API_KEY_SECRET are set.`,
    );
  }
}

const FACILITATOR_URL = resolvedFacilitatorUrl;

const REPO_ROOT = path.resolve(import.meta.dirname, "../../..");
const DB_PATH = process.env.DB_PATH ?? path.resolve(REPO_ROOT, "swarmapi.sqlite");
const GATEWAY_URL = process.env.GATEWAY_URL ?? `http://localhost:${PORT}`;
const BRAVE_API_KEY = process.env.BRAVE_API_KEY ?? "";
const GITHUB_TOKEN = process.env.GITHUB_TOKEN ?? "";

if (PAY_TO_ADDRESS === PLACEHOLDER_PAY_TO) {
  console.warn(
    "[gateway] PAY_TO_ADDRESS is not set — using a placeholder. " +
      "402 generation will work, but settled funds would go to the placeholder. " +
      "Set PAY_TO_ADDRESS in .env before exercising the SDK end-to-end.",
  );
}

const db = createDb(DB_PATH);
ensureSchema(db);

interface RouteSpec {
  id: string;
  method: "GET" | "POST";
  resource: string;
  priceAtomic: string;
  priceLabel: string;
  name: string;
  description: string;
}

const ROUTES: RouteSpec[] = [
  {
    id: "companies-resolve",
    method: "POST",
    resource: "/v1/companies/resolve",
    priceAtomic: "2000",
    priceLabel: "$0.002",
    name: "Resolve company",
    description:
      "Resolve a free-form query (ticker, CIK, or company name) to canonical SEC records. Returns up to 5 ranked matches.",
  },
  {
    id: "companies-filings",
    method: "GET",
    resource: "/v1/companies/filings",
    priceAtomic: "5000",
    priceLabel: "$0.005",
    name: "List SEC filings",
    description:
      "List recent SEC filings (10-K, 10-Q, 8-K, S-1, Form 4, etc.) for a CIK with optional type filter and date floor.",
  },
  {
    id: "filings-extract",
    method: "GET",
    resource: "/v1/filings/extract",
    priceAtomic: "50000",
    priceLabel: "$0.05",
    name: "Extract filing items",
    description:
      "Parse a 10-K, 10-Q, or 8-K from EDGAR into structured per-Item JSON. Pass an accession (e.g. 0000320193-26-000011) and optionally items=1A,7,7A to filter.",
  },
  {
    id: "companies-news",
    method: "GET",
    resource: "/v1/companies/news",
    priceAtomic: "20000",
    priceLabel: "$0.02",
    name: "Recent news",
    description:
      "Recent news mentions of a company indexed by GDELT 2.0. Pass company=<name>, optional since/until (YYYY-MM-DD), language (default english), limit (default 25, max 75).",
  },
  {
    id: "companies-jobs",
    method: "GET",
    resource: "/v1/companies/jobs",
    priceAtomic: "10000",
    priceLabel: "$0.01",
    name: "Open jobs",
    description:
      "Open job postings from a company's public Greenhouse or Lever board. Pass company=<name> for auto-discovery, or ats=greenhouse|lever&slug=<slug> for explicit lookup.",
  },
  {
    id: "companies-insiders",
    method: "GET",
    resource: "/v1/companies/insiders",
    priceAtomic: "30000",
    priceLabel: "$0.03",
    name: "Insider transactions",
    description:
      "Form 4 insider transactions (purchases, sales, awards, derivative exercises) for a company's officers, directors, and 10% holders, parsed from EDGAR XML. Pass id=<CIK>, optional since/until (YYYY-MM-DD), limit (default 10, max 50).",
  },
  {
    id: "web-search",
    method: "GET",
    resource: "/v1/web/search",
    priceAtomic: "10000",
    priceLabel: "$0.01",
    name: "Web search",
    description:
      "General web search via the Brave Search API. Pass q=<query>, optional count (default 10, max 20), country (e.g. US), freshness (pd | pw | pm | py for past day/week/month/year), language (e.g. en).",
  },
  {
    id: "github-repo",
    method: "GET",
    resource: "/v1/github/repo",
    priceAtomic: "5000",
    priceLabel: "$0.005",
    name: "GitHub repository snapshot",
    description:
      "Snapshot of a public GitHub repo: stars, forks, languages, license, default branch, archive status, plus the last 10 commits, last 5 releases, and top contributors. Pass slug=<owner/repo> (e.g. facebook/react) or url=https://github.com/owner/repo.",
  },
  {
    id: "packages-info",
    method: "GET",
    resource: "/v1/packages/info",
    priceAtomic: "5000",
    priceLabel: "$0.005",
    name: "Package metadata + CVE scan",
    description:
      "Latest version, license, deps, recent versions, deprecation status, and known vulnerabilities (via OSV.dev) for an npm, PyPI, or cargo package. Pass registry=npm|pypi|cargo and name=<package-name>.",
  },
];

for (const r of ROUTES) {
  upsertEndpoint(db, {
    id: r.id,
    name: r.name,
    description: r.description,
    method: r.method,
    resource: r.resource,
    priceAtomic: r.priceAtomic,
    asset: USDC_ASSET,
    network: NETWORK,
    payTo: PAY_TO_ADDRESS,
    gatewayUrl: GATEWAY_URL,
  });
}

const facilitatorClient = new HTTPFacilitatorClient({
  url: FACILITATOR_URL,
  createAuthHeaders: facilitatorAuth,
});
const resourceServer = new x402ResourceServer(facilitatorClient).register(
  NETWORK as `${string}:${string}`,
  new ExactEvmScheme(),
);

const app = express();

app.use((req, res, next) => {
  const sigHeader = req.headers["x-payment"] ?? req.headers["payment-signature"];
  const sig = Array.isArray(sigHeader) ? sigHeader[0] : sigHeader;
  console.log(`[gateway] ${req.method} ${req.url} ${sig ? "(signed)" : "(unsigned)"}`);

  if (!sig) return next();

  res.on("finish", () => {
    const status: "settled" | "failed" = res.statusCode >= 200 && res.statusCode < 300 ? "settled" : "failed";

    let payerAddress: string | null = null;
    let amountAtomic: string | null = null;
    try {
      const payload = JSON.parse(Buffer.from(sig, "base64").toString("utf8"));
      payerAddress = payload?.payload?.authorization?.from ?? null;
      amountAtomic = payload?.payload?.authorization?.value ?? null;
    } catch {
      // unparseable payload; leave fields null
    }

    let txHash: string | null = null;
    let errorCode: string | null = null;
    if (status === "settled") {
      const settleHeader =
        res.getHeader("payment-response") ?? res.getHeader("x-payment-response");
      if (typeof settleHeader === "string") {
        try {
          const decoded = JSON.parse(Buffer.from(settleHeader, "base64").toString("utf8"));
          txHash = decoded?.transaction ?? decoded?.txHash ?? null;
        } catch {
          // unparseable settle response
        }
      }
    } else {
      const paymentRequired = res.getHeader("payment-required");
      if (typeof paymentRequired === "string") {
        try {
          const decoded = JSON.parse(Buffer.from(paymentRequired, "base64").toString("utf8"));
          errorCode = decoded?.error ?? null;
        } catch {
          // unparseable challenge
        }
      }
    }

    db.insert(payments)
      .values({
        id: randomUUID(),
        method: req.method,
        resource: req.path,
        status,
        payerAddress,
        payTo: PAY_TO_ADDRESS,
        asset: USDC_ASSET,
        network: NETWORK,
        amountAtomic,
        txHash,
        errorCode,
        createdAt: new Date(),
      })
      .run();
  });

  next();
});

app.use(express.json({ limit: "32kb" }));

// CORS for the public read-only endpoints below — the web apps (landing,
// dashboard, marketplace) live on different origins (Vercel subdomains) so
// they need CORS for the cross-origin fetches. The paid /v1/companies/... and
// /v1/filings/... endpoints don't need CORS because x402 clients are
// non-browser HTTP clients.
app.use((_req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  next();
});

// ---- Public, unpaid, read-only views over the operator data ----
// These power the landing / dashboard / marketplace web apps. They expose
// aggregate stats and the public endpoint catalog. No payment info beyond
// what's already on-chain.

app.get("/v1/stats", (_req: Request, res: Response) => {
  const settled = db
    .select({
      count: sql<number>`COUNT(*)`,
      sumAtomic: sql<string>`COALESCE(SUM(CAST(${payments.amountAtomic} AS INTEGER)), 0)`,
      uniquePayers: sql<number>`COUNT(DISTINCT ${payments.payerAddress})`,
    })
    .from(payments)
    .where(sql`${payments.status} = 'settled'`)
    .all();
  const failed = db
    .select({ count: sql<number>`COUNT(*)` })
    .from(payments)
    .where(sql`${payments.status} = 'failed'`)
    .all();
  const endpointCount = db
    .select({ count: sql<number>`COUNT(*)` })
    .from(endpoints)
    .all();
  res.json({
    settledCount: Number(settled[0]?.count ?? 0),
    failedCount: Number(failed[0]?.count ?? 0),
    revenueAtomic: String(settled[0]?.sumAtomic ?? 0),
    uniquePayers: Number(settled[0]?.uniquePayers ?? 0),
    endpointCount: Number(endpointCount[0]?.count ?? 0),
  });
});

app.get("/v1/payments", (req: Request, res: Response) => {
  const limit = Math.max(1, Math.min(Number(req.query.limit ?? 50), 200));
  const rows = db.select().from(payments).orderBy(desc(payments.createdAt)).limit(limit).all();
  res.json({ count: rows.length, payments: rows });
});

app.get("/v1/catalog", (_req: Request, res: Response) => {
  const rows = db.select().from(endpoints).all();
  res.json({ count: rows.length, endpoints: rows });
});

const paidRoutes: RoutesConfig = Object.fromEntries(
  ROUTES.map((r) => [
    `${r.method} ${r.resource}`,
    {
      accepts: [
        {
          scheme: "exact" as const,
          price: r.priceLabel,
          network: NETWORK,
          payTo: PAY_TO_ADDRESS,
        },
      ],
      description: r.description,
      mimeType: "application/json",
    },
  ]),
) as RoutesConfig;

app.use(paymentMiddleware(paidRoutes, resourceServer));

app.post("/v1/companies/resolve", async (req: Request, res: Response) => {
  const query = typeof req.body?.query === "string" ? req.body.query : null;
  if (!query) {
    return res.status(400).json({ error: "Provide { query: string } in the request body." });
  }
  try {
    const result = await resolveCompany(db, query);
    return res.json(result);
  } catch (err) {
    return upstreamFailure(res, err);
  }
});

app.get("/v1/companies/filings", async (req: Request, res: Response) => {
  const id = typeof req.query.id === "string" ? req.query.id : null;
  if (!id) {
    return res
      .status(400)
      .json({ error: "Provide ?id=<CIK> (10-digit zero-padded SEC CIK)." });
  }
  const types =
    typeof req.query.types === "string"
      ? req.query.types
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
      : undefined;
  const since = typeof req.query.since === "string" ? req.query.since : undefined;
  const limit = typeof req.query.limit === "string" ? Number(req.query.limit) : undefined;

  try {
    const result = await listFilings(db, id, { types, since, limit });
    return res.json(result);
  } catch (err) {
    return upstreamFailure(res, err);
  }
});

app.get("/v1/companies/news", async (req: Request, res: Response) => {
  const company = typeof req.query.company === "string" ? req.query.company.trim() : "";
  if (!company) {
    return res.status(400).json({ error: "Provide ?company=<name>." });
  }
  const since = typeof req.query.since === "string" ? req.query.since : undefined;
  const until = typeof req.query.until === "string" ? req.query.until : undefined;
  const language = typeof req.query.language === "string" ? req.query.language : undefined;
  const limit = typeof req.query.limit === "string" ? Number(req.query.limit) : undefined;
  try {
    const result = await listNews(db, company, { since, until, language, limit });
    return res.json(result);
  } catch (err) {
    return upstreamFailure(res, err);
  }
});

app.get("/v1/companies/jobs", async (req: Request, res: Response) => {
  const company = typeof req.query.company === "string" ? req.query.company.trim() : "";
  if (!company) {
    return res.status(400).json({ error: "Provide ?company=<name> (or ats=greenhouse|lever&slug=<slug>)." });
  }
  const limit = typeof req.query.limit === "string" ? Number(req.query.limit) : undefined;
  const ats =
    req.query.ats === "greenhouse" || req.query.ats === "lever"
      ? (req.query.ats as AtsProvider)
      : undefined;
  const slug = typeof req.query.slug === "string" ? req.query.slug : undefined;
  try {
    const result = await listJobs(db, company, { ats, slug, limit });
    return res.json(result);
  } catch (err) {
    return upstreamFailure(res, err);
  }
});

app.get("/v1/github/repo", async (req: Request, res: Response) => {
  const slug = typeof req.query.slug === "string" ? req.query.slug : null;
  const url = typeof req.query.url === "string" ? req.query.url : null;
  const target = slug ?? url;
  if (!target) {
    return res
      .status(400)
      .json({ error: "Provide ?slug=<owner/repo> or ?url=https://github.com/owner/repo." });
  }
  try {
    const result = await fetchRepoSnapshot(db, target, GITHUB_TOKEN);
    return res.json(result);
  } catch (err) {
    if (err instanceof Error && /Invalid GitHub slug/.test(err.message)) {
      return res.status(400).json({ error: err.message });
    }
    return upstreamFailure(res, err);
  }
});

app.get("/v1/packages/info", async (req: Request, res: Response) => {
  const registry = req.query.registry;
  const name = typeof req.query.name === "string" ? req.query.name.trim() : "";
  if (registry !== "npm" && registry !== "pypi" && registry !== "cargo") {
    return res.status(400).json({ error: "Provide ?registry=npm|pypi|cargo." });
  }
  if (!name) {
    return res.status(400).json({ error: "Provide ?name=<package-name>." });
  }
  try {
    const result = await fetchPackageInfo(db, registry as PackageRegistry, name);
    return res.json(result);
  } catch (err) {
    return upstreamFailure(res, err);
  }
});

app.get("/v1/companies/insiders", async (req: Request, res: Response) => {
  const id = typeof req.query.id === "string" ? req.query.id : null;
  if (!id) {
    return res.status(400).json({ error: "Provide ?id=<CIK>." });
  }
  const since = typeof req.query.since === "string" ? req.query.since : undefined;
  const until = typeof req.query.until === "string" ? req.query.until : undefined;
  const limit = typeof req.query.limit === "string" ? Number(req.query.limit) : undefined;
  try {
    const result = await listInsiderTransactions(db, id, { since, until, limit });
    return res.json(result);
  } catch (err) {
    return upstreamFailure(res, err);
  }
});

app.get("/v1/web/search", async (req: Request, res: Response) => {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  if (!q) {
    return res.status(400).json({ error: "Provide ?q=<query>." });
  }
  const count = typeof req.query.count === "string" ? Number(req.query.count) : undefined;
  const country = typeof req.query.country === "string" ? req.query.country : undefined;
  const freshness = typeof req.query.freshness === "string" ? req.query.freshness : undefined;
  const language = typeof req.query.language === "string" ? req.query.language : undefined;
  try {
    const result = await webSearch(db, q, BRAVE_API_KEY, { count, country, freshness, language });
    return res.json(result);
  } catch (err) {
    return upstreamFailure(res, err);
  }
});

app.get("/v1/filings/extract", async (req: Request, res: Response) => {
  const accession = typeof req.query.accession === "string" ? req.query.accession : null;
  if (!accession || !/^\d{10}-\d{2}-\d{6}$/.test(accession)) {
    return res.status(400).json({
      error:
        "Provide ?accession=NNNNNNNNNN-YY-NNNNNN (e.g. 0000320193-26-000011). Get one from /v1/companies/filings.",
    });
  }
  const items =
    typeof req.query.items === "string"
      ? req.query.items
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : undefined;
  try {
    const result = await extractFiling(db, accession, { items });
    return res.json(result);
  } catch (err) {
    return upstreamFailure(res, err);
  }
});

app.get("/health", (_req: Request, res: Response) => {
  res.json({ ok: true });
});

function upstreamFailure(res: Response, err: unknown) {
  if (err instanceof UpstreamError) {
    const status = err.status === 404 ? 404 : 502;
    return res.status(status).json({ error: err.message });
  }
  console.error("[gateway] handler error:", err);
  return res.status(500).json({ error: "Internal error" });
}

app.listen(PORT, () => {
  console.log(`[gateway] listening on http://localhost:${PORT}`);
  console.log(`[gateway] profile:     ${PROFILE} (${PROFILE_CFG.label})`);
  console.log(
    `[gateway] facilitator: ${FACILITATOR_URL}${facilitatorAuth ? "  (CDP JWT auth)" : ""}`,
  );
  console.log(`[gateway] usdc:        ${USDC_ASSET}`);
  console.log(`[gateway] network:     ${NETWORK}`);
  console.log(`[gateway] payTo:       ${PAY_TO_ADDRESS}`);
  console.log(`[gateway] db:          ${DB_PATH}`);
  console.log(`[gateway] routes:`);
  for (const r of ROUTES) {
    console.log(`             ${r.method.padEnd(4)} ${r.resource}  (${r.priceLabel})`);
  }
});
