import "dotenv/config";
import { createAgentClient } from "@swarmapi/sdk";

const fetch = createAgentClient({
  privateKey: process.env.AGENT_PRIVATE_KEY as `0x${string}`,
  maxSpendPerRequest: 60_000n,
});

const r = await fetch("http://localhost:3000/v1/companies/news?company=Anthropic&limit=8");
console.log("status:", r.status);
const j = (await r.json()) as {
  count?: number;
  articles?: Array<{ title: string; domain: string; publishedAt: string | null }>;
};
console.log("count:", j.count);
for (const a of (j.articles ?? []).slice(0, 8)) {
  console.log(
    `  [${a.domain}] ${a.publishedAt?.slice(0, 10) ?? "?"} — ${a.title.slice(0, 90)}`,
  );
}
