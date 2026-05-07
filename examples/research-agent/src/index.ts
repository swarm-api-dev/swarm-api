import "dotenv/config";
import { createAgentClient, BudgetExceededError } from "@agentpay/sdk";

const PRIVATE_KEY = process.env.AGENT_PRIVATE_KEY as `0x${string}` | undefined;
const GATEWAY_URL = process.env.GATEWAY_URL ?? "http://localhost:3000";

if (!PRIVATE_KEY || !PRIVATE_KEY.startsWith("0x")) {
  console.error("Set AGENT_PRIVATE_KEY in examples/research-agent/.env to a Base Sepolia 0x-prefixed private key.");
  process.exit(1);
}

const agentFetch = createAgentClient({
  privateKey: PRIVATE_KEY,
  maxSpendPerRequest: 10_000n,
});

const url = `${GATEWAY_URL}/api/example`;
console.log(`[agent] GET ${url}`);
console.log(`[agent] budget cap: 10000 atomic USDC ($0.01)`);

try {
  const res = await agentFetch(url);
  const body = await res.text();
  console.log(`[agent] status: ${res.status}`);
  console.log(`[agent] headers:`);
  res.headers.forEach((v, k) => console.log(`         ${k}: ${v.length > 120 ? v.slice(0, 120) + "..." : v}`));
  console.log(`[agent] body: ${body}`);
} catch (err) {
  if (err instanceof BudgetExceededError) {
    console.error(`[agent] budget guard tripped: ${err.message}`);
    process.exit(2);
  }
  console.error(`[agent] failed:`, err);
  process.exit(3);
}
