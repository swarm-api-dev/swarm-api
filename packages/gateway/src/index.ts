import "dotenv/config";
import { randomUUID } from "node:crypto";
import path from "node:path";
import express, { type Request, type Response } from "express";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { HTTPFacilitatorClient, type RoutesConfig } from "@x402/core/server";
import { createDb, ensureSchema, payments, upsertEndpoint } from "@agentpay/db";
import {
  extractFiling,
  listFilings,
  listJobs,
  listNews,
  resolveCompany,
  UpstreamError,
  type AtsProvider,
} from "@agentpay/company-intel";

const PORT = Number(process.env.PORT ?? 3000);
const PLACEHOLDER_PAY_TO = "0x0000000000000000000000000000000000000001";
const PAY_TO_ADDRESS = process.env.PAY_TO_ADDRESS ?? PLACEHOLDER_PAY_TO;

type NetworkProfile = "base-mainnet" | "base-sepolia";
const NETWORK_PROFILES: Record<
  NetworkProfile,
  { network: string; usdc: string; facilitator: string; label: string }
> = {
  "base-mainnet": {
    network: "eip155:8453",
    usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    facilitator: "https://facilitator.payai.network",
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
const FACILITATOR_URL = process.env.FACILITATOR_URL ?? PROFILE_CFG.facilitator;

const REPO_ROOT = path.resolve(import.meta.dirname, "../../..");
const DB_PATH = process.env.DB_PATH ?? path.resolve(REPO_ROOT, "agentpay.sqlite");
const GATEWAY_URL = process.env.GATEWAY_URL ?? `http://localhost:${PORT}`;

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

const facilitatorClient = new HTTPFacilitatorClient({ url: FACILITATOR_URL });
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
  console.log(`[gateway] facilitator: ${FACILITATOR_URL}`);
  console.log(`[gateway] usdc:        ${USDC_ASSET}`);
  console.log(`[gateway] network:     ${NETWORK}`);
  console.log(`[gateway] payTo:       ${PAY_TO_ADDRESS}`);
  console.log(`[gateway] db:          ${DB_PATH}`);
  console.log(`[gateway] routes:`);
  for (const r of ROUTES) {
    console.log(`             ${r.method.padEnd(4)} ${r.resource}  (${r.priceLabel})`);
  }
});
