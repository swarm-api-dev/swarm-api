#!/usr/bin/env node
import { readFileSync } from "node:fs";
import "dotenv/config";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { BudgetExceededError, createAgentClient } from "@swarm-api/sdk";

const CLI_ARGS = process.argv.slice(2);

function pkgVersion(): string {
  try {
    const url = new URL("../package.json", import.meta.url);
    const pkg = JSON.parse(readFileSync(url, "utf8")) as { version?: string };
    return typeof pkg.version === "string" ? pkg.version : "0.0.0";
  } catch {
    return "0.0.0";
  }
}

if (CLI_ARGS.some((a) => a === "--help" || a === "-h")) {
  process.stdout.write(makeHelpText());
  process.exit(0);
}

if (CLI_ARGS.some((a) => a === "--version" || a === "-v")) {
  process.stdout.write(`swarmapi-mcp/${pkgVersion()}\n`);
  process.exit(0);
}

function makeHelpText(): string {
  return `SwarmApi MCP server — paid gateway tools over stdio (Model Context Protocol).

Usage:
  swarmapi-mcp              Start the server (needs SWARMAPI_PRIVATE_KEY).
  swarmapi-mcp --help, -h   Show this message (no env required).
  swarmapi-mcp --version    Print version (no env required).

Environment (required to run the server):
  SWARMAPI_PRIVATE_KEY     Base mainnet 0x… private key with USDC (signs EIP-3009 per call).
  AGENT_PRIVATE_KEY        Alias for SWARMAPI_PRIVATE_KEY.

Environment (optional):
  SWARMAPI_GATEWAY_URL     Default: https://api.swarm-api.com
  SWARMAPI_MAX_SPEND_PER_REQUEST_ATOMIC  Default: 100000 ($0.10 USDC, 6 decimals)

Quick install:
  npx -y @swarm-api/setup

Web: https://swarm-api.com
npm: https://www.npmjs.com/package/@swarm-api/mcp
`;
}

const PRIVATE_KEY = process.env.SWARMAPI_PRIVATE_KEY ?? process.env.AGENT_PRIVATE_KEY;
const GATEWAY_URL = process.env.SWARMAPI_GATEWAY_URL ?? "https://api.swarm-api.com";
const MAX_SPEND = parseBigIntEnv(process.env.SWARMAPI_MAX_SPEND_PER_REQUEST_ATOMIC, 100_000n);

if (!PRIVATE_KEY || !PRIVATE_KEY.startsWith("0x")) {
  process.stderr.write(
    "[swarmapi-mcp] Missing SWARMAPI_PRIVATE_KEY. Set it to a Base 0x-prefixed private key with USDC balance.\n",
  );
  process.exit(1);
}

const fetchPaid = createAgentClient({
  privateKey: PRIVATE_KEY as `0x${string}`,
  maxSpendPerRequest: MAX_SPEND,
});

const server = new McpServer({
  name: "swarmapi",
  version: pkgVersion(),
});

server.registerTool(
  "resolve_company",
  {
    description:
      "Resolve a free-form company query (ticker, CIK, or company name) to canonical SEC records. Use this first when you only have a company name and need its CIK for the other tools. Returns up to 5 ranked matches. Cost: $0.002 USDC per call.",
    inputSchema: { query: z.string().min(1).describe("Ticker, 10-digit CIK, or free-form company name (e.g. 'AAPL', 'Apple Inc')") },
  },
  async ({ query }) => {
    return await callJson("POST", "/v1/companies/resolve", { body: { query } });
  },
);

server.registerTool(
  "list_filings",
  {
    description:
      "List a company's recent SEC filings (10-K, 10-Q, 8-K, S-1, Form 4, etc.). Pass the 10-digit CIK from resolve_company. Returns accession numbers needed by extract_filing. Cost: $0.005 USDC per call.",
    inputSchema: {
      id: z.string().describe("10-digit zero-padded SEC CIK (from resolve_company.matches[].cik)"),
      types: z
        .array(z.string())
        .optional()
        .describe("Filing form types to include, e.g. ['10-K','8-K']"),
      since: z.string().optional().describe("ISO date floor, e.g. 2024-01-01"),
      limit: z.number().int().min(1).max(100).optional().describe("Max filings (default 20, max 100)"),
    },
  },
  async ({ id, types, since, limit }) => {
    const params = new URLSearchParams({ id });
    if (types && types.length) params.set("types", types.join(","));
    if (since) params.set("since", since);
    if (limit) params.set("limit", String(limit));
    return await callJson("GET", `/v1/companies/filings?${params}`);
  },
);

server.registerTool(
  "extract_filing",
  {
    description:
      "Parse a specific SEC filing (10-K, 10-Q, 8-K) into structured per-Item JSON. Pass the accession number from list_filings. Returns sections like Item 1A (Risk Factors), Item 7 (MD&A), Item 5.02 (Officer changes) as separate fields with full text. Cost: $0.05 USDC per call.",
    inputSchema: {
      accession: z
        .string()
        .regex(/^\d{10}-\d{2}-\d{6}$/)
        .describe("Accession in NNNNNNNNNN-YY-NNNNNN format (from list_filings.filings[].accession)"),
      items: z
        .array(z.string())
        .optional()
        .describe("Restrict to specific items, e.g. ['1A','7'] for risk factors and MD&A"),
    },
  },
  async ({ accession, items }) => {
    const params = new URLSearchParams({ accession });
    if (items && items.length) params.set("items", items.join(","));
    return await callJson("GET", `/v1/filings/extract?${params}`);
  },
);

server.registerTool(
  "company_news",
  {
    description:
      "Recent news mentions of a company indexed by GDELT 2.0 (covers ~all news articles worldwide, refreshed every 15 minutes). Default 30-day window, English-language. Use this to find news after your training cutoff. Cost: $0.02 USDC per call.",
    inputSchema: {
      company: z.string().min(1).describe("Free-form company name (e.g. 'Anthropic', 'Apple Inc')"),
      since: z.string().optional().describe("ISO date floor, e.g. 2025-10-01"),
      until: z.string().optional().describe("ISO date ceiling, e.g. 2025-11-04"),
      language: z.string().optional().describe("Source language (default: english)"),
      limit: z.number().int().min(1).max(75).optional().describe("Max articles (default 25, max 75)"),
    },
  },
  async ({ company, since, until, language, limit }) => {
    const params = new URLSearchParams({ company });
    if (since) params.set("since", since);
    if (until) params.set("until", until);
    if (language) params.set("language", language);
    if (limit) params.set("limit", String(limit));
    return await callJson("GET", `/v1/companies/news?${params}`);
  },
);

server.registerTool(
  "company_jobs",
  {
    description:
      "Open job postings on a company's public Greenhouse or Lever board. Useful as a proxy for hiring trends, focus areas, and growth. Auto-discovers the ATS for many startups; pass ats=greenhouse|lever and slug if you know them. Cost: $0.01 USDC per call.",
    inputSchema: {
      company: z.string().min(1).describe("Free-form company name"),
      ats: z.enum(["greenhouse", "lever"]).optional().describe("Override ATS detection"),
      slug: z.string().optional().describe("Override slug detection"),
      limit: z.number().int().min(1).max(100).optional().describe("Max postings (default 25, max 100)"),
    },
  },
  async ({ company, ats, slug, limit }) => {
    const params = new URLSearchParams({ company });
    if (ats) params.set("ats", ats);
    if (slug) params.set("slug", slug);
    if (limit) params.set("limit", String(limit));
    return await callJson("GET", `/v1/companies/jobs?${params}`);
  },
);

server.registerTool(
  "insider_transactions",
  {
    description:
      "Form 4 insider transactions (purchases, sales, awards, derivative exercises) for a company's officers, directors, and 10% holders, parsed from EDGAR XML. CEO/CFO open-market buys/sells are real material signals. Pass the 10-digit CIK from resolve_company. Cost: $0.03 USDC per call.",
    inputSchema: {
      id: z.string().describe("10-digit zero-padded SEC CIK (from resolve_company.matches[].cik)"),
      since: z.string().optional().describe("ISO date floor for filing date, e.g. 2025-01-01"),
      until: z.string().optional().describe("ISO date ceiling for transaction date"),
      limit: z.number().int().min(1).max(50).optional().describe("Max Form 4 filings to fetch (default 10, max 50)"),
    },
  },
  async ({ id, since, until, limit }) => {
    const params = new URLSearchParams({ id });
    if (since) params.set("since", since);
    if (until) params.set("until", until);
    if (limit) params.set("limit", String(limit));
    return await callJson("GET", `/v1/companies/insiders?${params}`);
  },
);

server.registerTool(
  "web_search",
  {
    description:
      "General web search via the Brave Search API. Use this when you need information that isn't company-keyed — current events, technical answers, multi-source research. Cost: $0.01 USDC per call.",
    inputSchema: {
      q: z.string().min(1).describe("Search query (any natural-language string)"),
      count: z.number().int().min(1).max(20).optional().describe("Number of results (default 10, max 20)"),
      country: z.string().optional().describe("ISO country code (e.g. US, GB) to bias results"),
      freshness: z
        .enum(["pd", "pw", "pm", "py"])
        .optional()
        .describe("Time window: pd (past day), pw (week), pm (month), py (year)"),
      language: z.string().optional().describe("Language code (e.g. en, fr)"),
    },
  },
  async ({ q, count, country, freshness, language }) => {
    const params = new URLSearchParams({ q });
    if (count) params.set("count", String(count));
    if (country) params.set("country", country);
    if (freshness) params.set("freshness", freshness);
    if (language) params.set("language", language);
    return await callJson("GET", `/v1/web/search?${params}`);
  },
);

server.registerTool(
  "github_repo",
  {
    description:
      "Snapshot of a public GitHub repository: stars, forks, languages, license, archive status, plus the last 10 commits, last 5 releases, and top contributors. Use this to assess maintenance, recency, and health before recommending or depending on a repo. Cost: $0.005 USDC per call.",
    inputSchema: {
      slug: z
        .string()
        .min(3)
        .describe("owner/repo (e.g. 'facebook/react') or full GitHub URL"),
    },
  },
  async ({ slug }) => {
    return await callJson("GET", `/v1/github/repo?slug=${encodeURIComponent(slug)}`);
  },
);

server.registerTool(
  "package_info",
  {
    description:
      "Latest version, license, dependencies, recent releases, deprecation status, and known CVE vulnerabilities (via OSV.dev) for a package on npm, PyPI, or cargo. Use this to check whether a dependency is safe, current, and not deprecated. Cost: $0.005 USDC per call.",
    inputSchema: {
      registry: z
        .enum(["npm", "pypi", "cargo"])
        .describe("Package registry"),
      name: z.string().min(1).describe("Package name (e.g. 'react', 'requests', 'serde')"),
    },
  },
  async ({ registry, name }) => {
    const params = new URLSearchParams({ registry, name });
    return await callJson("GET", `/v1/packages/info?${params}`);
  },
);

interface CallOptions {
  body?: unknown;
}

async function callJson(method: "GET" | "POST", path: string, opts: CallOptions = {}) {
  const url = `${GATEWAY_URL}${path}`;
  try {
    const res = await fetchPaid(url, {
      method,
      headers: opts.body ? { "content-type": "application/json" } : undefined,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    const text = await res.text();
    if (res.status >= 400) {
      return errorResult(`Gateway returned ${res.status}: ${text.slice(0, 500)}`);
    }
    return { content: [{ type: "text" as const, text }] };
  } catch (err) {
    if (err instanceof BudgetExceededError) {
      return errorResult(
        `BudgetExceededError: requested ${err.requested} > allowed ${err.allowed}. Increase SWARMAPI_MAX_SPEND_PER_REQUEST_ATOMIC.`,
      );
    }
    const msg = err instanceof Error ? err.message : String(err);
    return errorResult(`Tool call failed: ${msg}`);
  }
}

function errorResult(message: string) {
  return {
    isError: true,
    content: [{ type: "text" as const, text: message }],
  };
}

function parseBigIntEnv(raw: string | undefined, fallback: bigint): bigint {
  if (!raw) return fallback;
  try {
    return BigInt(raw);
  } catch {
    return fallback;
  }
}

const transport = new StdioServerTransport();
await server.connect(transport);
process.stderr.write(
  `[swarmapi-mcp] connected. gateway=${GATEWAY_URL} maxSpend=${MAX_SPEND} atomic\n`,
);
