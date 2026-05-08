import "dotenv/config";
import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const PRIVATE_KEY = process.env.AGENT_PRIVATE_KEY;
if (!PRIVATE_KEY) {
  console.error("Set AGENT_PRIVATE_KEY in examples/research-agent/.env");
  process.exit(1);
}

const repoRoot = path.resolve(import.meta.dirname, "../../..");
const serverEntry = path.resolve(repoRoot, "packages/mcp/src/index.ts");

const transport = new StdioClientTransport({
  command: "npx",
  args: ["tsx", serverEntry],
  env: {
    ...process.env,
    AGENTPAY_PRIVATE_KEY: PRIVATE_KEY,
    AGENTPAY_GATEWAY_URL: "http://localhost:3000",
    AGENTPAY_MAX_SPEND_PER_REQUEST_ATOMIC: "60000",
  },
});

const client = new Client({ name: "agentpay-mcp-smoketest", version: "0.0.1" }, { capabilities: {} });
await client.connect(transport);

console.log("\n=== tools/list ===");
const { tools } = await client.listTools();
for (const t of tools) {
  console.log(`  ${t.name}: ${(t.description ?? "").slice(0, 90)}`);
}

console.log("\n=== call resolve_company AAPL ===");
const r1 = await client.callTool({
  name: "resolve_company",
  arguments: { query: "AAPL" },
});
const t1 = (r1.content as Array<{ type: string; text?: string }>)[0]?.text ?? "(no text)";
console.log("isError:", r1.isError ?? false);
console.log(t1.slice(0, 400));

console.log("\n=== call company_jobs Anthropic ===");
const r2 = await client.callTool({
  name: "company_jobs",
  arguments: { company: "Anthropic", limit: 3 },
});
const t2 = (r2.content as Array<{ type: string; text?: string }>)[0]?.text ?? "(no text)";
console.log("isError:", r2.isError ?? false);
console.log(t2.slice(0, 600));

await client.close();
