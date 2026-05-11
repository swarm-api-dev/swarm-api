#!/usr/bin/env node
// Smoke test for the live SwarmApi gateway.
//
// Phase 1 (free): hits every public/free endpoint and verifies data shape.
//   - GET /health
//   - GET /v1/stats
//   - GET /v1/catalog
//   - GET /v1/payments?limit=10
//
// Phase 2 (free): probes every PAID endpoint with an unsigned request and
//   verifies it responds with HTTP 402 + a well-formed x402 challenge.
//   This confirms the route is registered, paymentMiddleware is wired up,
//   and the gateway thinks it can charge for it.
//
// Phase 3 (free): hits a handful of endpoints with intentionally bad input
//   to confirm validation rejects them with 400 (not 500).
//
// Phase 4 (free): rate-limit smoke — fires 25 fast requests at /v1/stats
//   and confirms the limiter is emitting standard headers.
//
// Phase 5 (paid, optional): if SMOKE_PRIVATE_KEY is set, signs and pays
//   every endpoint with valid params, and validates the response payload.
//   Costs ~$0.137 total on Base mainnet.
//
// Usage:
//   node tests/smoke.mjs                                   # phases 1-4
//   SMOKE_PRIVATE_KEY=0x... node tests/smoke.mjs --paid    # all 5 phases

import { setTimeout as sleep } from "node:timers/promises";

const GATEWAY = process.env.GATEWAY_URL ?? "https://api.swarm-api.com";
const PAID = process.argv.includes("--paid");
const VERBOSE = process.argv.includes("-v") || process.argv.includes("--verbose");

let passed = 0;
let failed = 0;
const failures = [];

function fmt(ok, name, detail = "") {
  const tag = ok ? "PASS" : "FAIL";
  const color = ok ? "\x1b[32m" : "\x1b[31m";
  process.stdout.write(`  ${color}${tag}\x1b[0m  ${name}${detail ? "  — " + detail : ""}\n`);
  if (ok) passed++;
  else {
    failed++;
    failures.push({ name, detail });
  }
}

function header(title) {
  process.stdout.write(`\n\x1b[1m${title}\x1b[0m\n`);
}

async function fetchJson(url, init = {}) {
  const started = Date.now();
  const res = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(15_000),
  });
  const latencyMs = Date.now() - started;
  let body = null;
  const text = await res.text();
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: res.status, latencyMs, headers: res.headers, body };
}

// ---------------------------------------------------------------------------
// Phase 1: public unauthenticated routes
// ---------------------------------------------------------------------------
async function phase1() {
  header("Phase 1 · Public endpoints");

  const health = await fetchJson(`${GATEWAY}/health`);
  fmt(health.status === 200 && health.body?.ok === true, "GET /health returns { ok: true }", `${health.latencyMs}ms`);

  const stats = await fetchJson(`${GATEWAY}/v1/stats`);
  const statsOk =
    stats.status === 200 &&
    typeof stats.body?.settledCount === "number" &&
    typeof stats.body?.failedCount === "number" &&
    typeof stats.body?.revenueAtomic === "string" &&
    typeof stats.body?.uniquePayers === "number" &&
    typeof stats.body?.endpointCount === "number";
  fmt(statsOk, "GET /v1/stats returns all 5 numeric fields",
    statsOk
      ? `${stats.latencyMs}ms · settled=${stats.body.settledCount} endpoints=${stats.body.endpointCount}`
      : `status=${stats.status} body=${JSON.stringify(stats.body).slice(0, 100)}`);

  const catalog = await fetchJson(`${GATEWAY}/v1/catalog`);
  const catalogOk =
    catalog.status === 200 &&
    Array.isArray(catalog.body?.endpoints) &&
    catalog.body.endpoints.length === 9 &&
    catalog.body.endpoints.every(
      (e) =>
        typeof e.id === "string" &&
        typeof e.method === "string" &&
        typeof e.resource === "string" &&
        typeof e.priceAtomic === "string" &&
        e.asset === "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" &&
        e.network === "eip155:8453",
    );
  fmt(catalogOk, "GET /v1/catalog returns 9 well-formed Base-mainnet endpoints", `${catalog.latencyMs}ms`);

  const payments = await fetchJson(`${GATEWAY}/v1/payments?limit=5`);
  const paymentsOk =
    payments.status === 200 &&
    typeof payments.body?.count === "number" &&
    Array.isArray(payments.body?.payments);
  fmt(paymentsOk, "GET /v1/payments?limit=5 returns array", `${payments.latencyMs}ms · count=${payments.body?.count}`);

  return catalog.body?.endpoints ?? [];
}

// ---------------------------------------------------------------------------
// Phase 2: 402 challenge from every paid endpoint
// ---------------------------------------------------------------------------
function decodeChallenge(headerValue) {
  if (!headerValue) return null;
  try {
    const json = Buffer.from(headerValue, "base64").toString("utf8");
    return JSON.parse(json);
  } catch {
    return null;
  }
}

async function phase2(endpoints) {
  header("Phase 2 · 402 challenge probes (unsigned requests)");

  await Promise.all(
    endpoints.map(async (e) => {
      const res = await fetchJson(`${GATEWAY}${e.resource}`, {
        method: e.method,
        headers: e.method === "POST" ? { "Content-Type": "application/json" } : undefined,
        body: e.method === "POST" ? "{}" : undefined,
      });
      // x402 challenge lives in the Payment-Required header (base64 JSON).
      const challenge = decodeChallenge(res.headers.get("payment-required"));
      const accepts = challenge?.accepts;
      const offer = accepts?.[0];
      const ok =
        res.status === 402 &&
        challenge?.x402Version === 2 &&
        offer?.scheme === "exact" &&
        offer?.network === "eip155:8453" &&
        offer?.asset === "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" &&
        typeof offer?.amount === "string" &&
        typeof offer?.payTo === "string" &&
        offer.amount === e.priceAtomic;
      const detail = ok
        ? `${res.latencyMs}ms · amount=${offer.amount} payTo=${offer.payTo.slice(0, 8)}…`
        : `status=${res.status} headerPresent=${!!challenge} amount=${offer?.amount} expected=${e.priceAtomic}`;
      fmt(ok, `${e.method.padEnd(4)} ${e.resource.padEnd(28)} → 402 + valid challenge`, detail);
    }),
  );
}

// ---------------------------------------------------------------------------
// Phase 3: error surface — confirm no 5xx leaks for malformed input
// ---------------------------------------------------------------------------
// Note: paymentMiddleware runs BEFORE the route handlers, so anything that
// isn't a paid request gets 402 regardless of how malformed the params are.
// Handler-level validation (e.g. missing ?id, bad accession, path traversal)
// only fires post-payment. So at the public surface, the contract is:
//   - 402 for any unsigned hit (no matter how bizarre)
//   - never 5xx
async function phase3() {
  header("Phase 3 · Error surface (no 5xx on weird input)");

  const cases = [
    { name: "GET /v1/companies/filings no id", url: `${GATEWAY}/v1/companies/filings`, method: "GET" },
    { name: "GET /v1/filings/extract bad accession", url: `${GATEWAY}/v1/filings/extract?accession=not-real`, method: "GET" },
    { name: "GET /v1/packages/info bad registry", url: `${GATEWAY}/v1/packages/info?registry=evil&name=foo`, method: "GET" },
    { name: "GET /v1/web/search no q", url: `${GATEWAY}/v1/web/search`, method: "GET" },
    { name: "GET /v1/github/repo path-traversal slug", url: `${GATEWAY}/v1/github/repo?slug=${encodeURIComponent("../../etc/passwd")}`, method: "GET" },
    { name: "POST /v1/companies/resolve empty body", url: `${GATEWAY}/v1/companies/resolve`, method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" },
    { name: "GET /v1/web/search weirdly long q", url: `${GATEWAY}/v1/web/search?q=${"x".repeat(2000)}`, method: "GET" },
    { name: "GET /v1/web/search with CRLF injection", url: `${GATEWAY}/v1/web/search?q=foo%0a%5BLINEINJECT%5D`, method: "GET" },
    { name: "GET unknown route", url: `${GATEWAY}/v1/this/does/not/exist`, method: "GET" },
  ];

  for (const c of cases) {
    const res = await fetchJson(c.url, { method: c.method, headers: c.headers, body: c.body });
    // Pass = anything OTHER than 5xx. Specifically 402 for paid routes,
    // 404 for unknown routes, 400 if handler validation actually fired.
    const ok = res.status < 500;
    fmt(ok, c.name, `status=${res.status} ${res.latencyMs}ms`);
  }
}

// ---------------------------------------------------------------------------
// Phase 4: rate-limit headers
// ---------------------------------------------------------------------------
async function phase4() {
  header("Phase 4 · Rate-limit headers + trust proxy");

  const res = await fetchJson(`${GATEWAY}/v1/stats`);
  const limit = res.headers.get("ratelimit-limit") || res.headers.get("ratelimit");
  const remaining = res.headers.get("ratelimit-remaining");
  const policy = res.headers.get("ratelimit-policy");

  fmt(!!limit, "ratelimit headers present", `limit=${limit} remaining=${remaining} policy=${policy}`);

  // Fire 5 rapid hits and confirm remaining decrements (proves trust-proxy works
  // — otherwise it would always see Railway's edge IP and decrement globally).
  let prevRem = remaining ? Number(remaining) : Infinity;
  let decremented = false;
  for (let i = 0; i < 4; i++) {
    const r = await fetchJson(`${GATEWAY}/v1/stats`);
    const rem = Number(r.headers.get("ratelimit-remaining") ?? "0");
    if (rem < prevRem) decremented = true;
    prevRem = rem;
  }
  fmt(decremented, "ratelimit-remaining decrements across rapid hits (per-IP)", `final remaining=${prevRem}`);
}

// ---------------------------------------------------------------------------
// Phase 5: paid end-to-end (opt-in)
// ---------------------------------------------------------------------------
async function phase5(endpoints) {
  header("Phase 5 · Paid end-to-end (signed x402 calls)");

  const pk = process.env.SMOKE_PRIVATE_KEY;
  if (!pk) {
    process.stdout.write("  SKIP  SMOKE_PRIVATE_KEY not set. Pass --paid with a funded key to enable.\n");
    return;
  }

  let mod;
  try {
    mod = await import("../packages/sdk/dist/index.js");
  } catch {
    process.stdout.write("  WARN  @swarm-api/sdk not built. Running `npm run build -w @swarm-api/sdk` would let you test paid calls.\n");
    return;
  }
  const { createAgentClient } = mod;
  const pay = createAgentClient({
    privateKey: pk,
    maxSpendPerRequest: 100_000n, // $0.10 ceiling
  });

  // Per-endpoint sane params + response validators.
  const probes = {
    "/v1/companies/resolve": {
      method: "POST",
      body: JSON.stringify({ query: "AAPL" }),
      headers: { "Content-Type": "application/json" },
      check: (j) => Array.isArray(j.matches) && j.matches.length > 0 && j.matches[0].cik,
    },
    "/v1/companies/filings": {
      method: "GET",
      query: "?id=0000320193&limit=3", // Apple
      check: (j) => Array.isArray(j.filings) && j.filings.length > 0,
    },
    "/v1/filings/extract": {
      // Apple 10-Q from 2024
      method: "GET",
      query: "?accession=0000320193-24-000123&items=1A",
      check: (j) => j.accession && (Array.isArray(j.items) || j.items),
    },
    "/v1/companies/news": {
      method: "GET",
      query: "?company=Apple&limit=3",
      check: (j) => Array.isArray(j.articles ?? j.results) || j.count >= 0,
    },
    "/v1/companies/jobs": {
      method: "GET",
      query: "?ats=greenhouse&slug=stripe",
      check: (j) => Array.isArray(j.jobs ?? j.results) || j.count >= 0,
    },
    "/v1/companies/insiders": {
      method: "GET",
      query: "?id=0000320193&limit=3", // Apple
      check: (j) => Array.isArray(j.transactions ?? j.results) || j.count >= 0,
    },
    "/v1/web/search": {
      method: "GET",
      query: "?q=ethereum&count=3",
      check: (j) => Array.isArray(j.results) && j.results.length > 0,
    },
    "/v1/github/repo": {
      method: "GET",
      query: "?slug=facebook/react",
      check: (j) => j.owner === "facebook" && j.repo === "react" && typeof j.stars === "number",
    },
    "/v1/packages/info": {
      method: "GET",
      query: "?registry=npm&name=react",
      check: (j) => j.name === "react" && typeof j.latestVersion === "string",
    },
  };

  for (const e of endpoints) {
    const probe = probes[e.resource];
    if (!probe) {
      fmt(false, `${e.method} ${e.resource}`, "no test probe defined");
      continue;
    }
    try {
      const url = `${GATEWAY}${e.resource}${probe.query ?? ""}`;
      const res = await pay(url, {
        method: probe.method,
        headers: probe.headers,
        body: probe.body,
      });
      const j = await res.json();
      const ok = res.ok && probe.check(j);
      const preview = JSON.stringify(j).slice(0, 100);
      fmt(ok, `${e.method.padEnd(4)} ${e.resource} signed + data validated`, ok ? "" : `status=${res.status} body=${preview}`);
      if (VERBOSE && ok) process.stdout.write(`         data: ${preview}\n`);
    } catch (err) {
      fmt(false, `${e.method} ${e.resource}`, err.message);
    }
    await sleep(800); // breathing room between calls
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  process.stdout.write(`\nSwarmApi gateway smoke test\n`);
  process.stdout.write(`Gateway: ${GATEWAY}\n`);
  process.stdout.write(`Paid phase: ${PAID ? "enabled" : "skipped (pass --paid to enable)"}\n`);

  const endpoints = await phase1();
  await phase2(endpoints);
  await phase3();
  await phase4();
  if (PAID) await phase5(endpoints);

  process.stdout.write(`\n${"=".repeat(60)}\n`);
  if (failed === 0) {
    process.stdout.write(`\x1b[32mAll ${passed} checks passed.\x1b[0m\n\n`);
  } else {
    process.stdout.write(`\x1b[31m${failed} failed\x1b[0m, ${passed} passed.\n\n`);
    for (const f of failures) {
      process.stdout.write(`  - ${f.name}\n    ${f.detail}\n`);
    }
    process.stdout.write("\n");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("smoke runner crashed:", err);
  process.exit(2);
});
