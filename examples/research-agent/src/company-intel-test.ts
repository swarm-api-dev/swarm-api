import "dotenv/config";
import { createAgentClient } from "@agentpay/sdk";

const PRIVATE_KEY = process.env.AGENT_PRIVATE_KEY as `0x${string}`;
const GATEWAY = process.env.GATEWAY_URL ?? "http://localhost:3000";

const fetch = createAgentClient({
  privateKey: PRIVATE_KEY,
  maxSpendPerRequest: 50000n,
});

async function pretty(label: string, res: Response) {
  console.log(`\n=== ${label} ===`);
  console.log(`status: ${res.status}`);
  const json = await res.json();
  console.log(JSON.stringify(json, null, 2).slice(0, 2000));
}

const r1 = await fetch(`${GATEWAY}/v1/companies/resolve`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ query: "AAPL" }),
});
await pretty("resolve AAPL", r1);

const r2 = await fetch(`${GATEWAY}/v1/companies/resolve`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ query: "Anthropic" }),
});
await pretty("resolve Anthropic", r2);

const r3 = await fetch(
  `${GATEWAY}/v1/companies/filings?id=0000320193&types=10-K,8-K&limit=5`,
);
await pretty("filings AAPL 10-K and 8-K (last 5)", r3);
