import "dotenv/config";
import { createAgentClient } from "@agentpay/sdk";

const fetch = createAgentClient({
  privateKey: process.env.AGENT_PRIVATE_KEY as `0x${string}`,
  maxSpendPerRequest: 60_000n,
});

async function show(label: string, url: string) {
  console.log(`\n=== ${label} ===`);
  const r = await fetch(url);
  console.log(`status: ${r.status}`);
  const j = await r.json();
  console.log(JSON.stringify(j, null, 2).slice(0, 2500));
}

await show(
  "insiders Apple (limit 3)",
  "http://localhost:3000/v1/companies/insiders?id=0000320193&limit=3",
);

await show(
  "web_search 'anthropic claude 4.5' (no key set)",
  "http://localhost:3000/v1/web/search?q=anthropic%20claude%204.5&count=3",
);
