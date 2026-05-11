import "dotenv/config";
import { createAgentClient } from "@swarm-api/sdk";

const fetch = createAgentClient({
  privateKey: process.env.AGENT_PRIVATE_KEY as `0x${string}`,
  maxSpendPerRequest: 60_000n,
});

async function show(label: string, url: string) {
  console.log(`\n=== ${label} ===`);
  const r = await fetch(url);
  console.log(`status: ${r.status}`);
  const j = await r.json();
  console.log(JSON.stringify(j, null, 2).slice(0, 2200));
}

await show("github_repo facebook/react", "http://localhost:3000/v1/github/repo?slug=facebook/react");
await show("package_info npm:react", "http://localhost:3000/v1/packages/info?registry=npm&name=react");
await show("package_info pypi:requests", "http://localhost:3000/v1/packages/info?registry=pypi&name=requests");
await show("package_info cargo:serde", "http://localhost:3000/v1/packages/info?registry=cargo&name=serde");
