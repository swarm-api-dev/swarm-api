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
  if (j.articles) {
    const a = j.articles as Array<{ title: string; domain: string; publishedAt: string | null }>;
    console.log(`count: ${j.count}`);
    for (const x of a.slice(0, 5)) {
      console.log(`  [${x.domain}] ${x.publishedAt ?? "?"} — ${x.title.slice(0, 100)}`);
    }
  } else if (j.jobs !== undefined) {
    console.log(`source: ${j.source ?? "(none)"}, slug: ${j.slug ?? "(none)"}, count: ${j.count}`);
    for (const note of j.notes) console.log(`  note: ${note}`);
    const jobs = j.jobs as Array<{ title: string; location: string | null; department: string | null; postedAt: string | null }>;
    for (const x of jobs.slice(0, 5)) {
      console.log(
        `  ${x.title}  [${x.department ?? "?"} / ${x.location ?? "?"}]  ${x.postedAt?.slice(0, 10) ?? "?"}`,
      );
    }
  } else {
    console.log(JSON.stringify(j, null, 2).slice(0, 600));
  }
}

await show("news Apple last 30d", "http://localhost:3000/v1/companies/news?company=Apple%20Inc&limit=10");
await show("news Anthropic last 30d", "http://localhost:3000/v1/companies/news?company=Anthropic&limit=10");
await show("jobs Anthropic (known map)", "http://localhost:3000/v1/companies/jobs?company=Anthropic&limit=5");
await show("jobs Stripe (known map → lever)", "http://localhost:3000/v1/companies/jobs?company=Stripe&limit=5");
await show("jobs OpenAI (known map → greenhouse)", "http://localhost:3000/v1/companies/jobs?company=OpenAI&limit=5");
await show("jobs xAI (auto-discovery, may 404)", "http://localhost:3000/v1/companies/jobs?company=xAI&limit=5");
