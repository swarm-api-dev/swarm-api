import "dotenv/config";
import { createAgentClient, BudgetExceededError } from "@swarmapi/sdk";
import { generatePrivateKey } from "viem/accounts";

const GATEWAY_URL = process.env.GATEWAY_URL ?? "http://localhost:3000";

const cheapAgent = createAgentClient({
  privateKey: generatePrivateKey(),
  maxSpendPerRequest: 999n,
});

console.log(`[budget-test] cap is 999 atomic USDC, gateway charges 1000 — expecting BudgetExceededError.`);

try {
  await cheapAgent(`${GATEWAY_URL}/api/example`);
  console.error(`[budget-test] FAIL — expected throw, got a response.`);
  process.exit(1);
} catch (err) {
  if (err instanceof BudgetExceededError) {
    console.log(`[budget-test] OK — budget guard threw: ${err.message}`);
    process.exit(0);
  }
  console.error(`[budget-test] FAIL — wrong error type:`, err);
  process.exit(1);
}
