import "dotenv/config";
import { createAgentClient } from "@swarm-api/sdk";

const fetch = createAgentClient({
  privateKey: process.env.AGENT_PRIVATE_KEY as `0x${string}`,
  maxSpendPerRequest: 60_000n,
});

const accession = process.argv[2] ?? "0000320193-26-000011";
const url = `http://localhost:3000/v1/filings/extract?accession=${accession}`;

console.log(`GET ${url}`);
const r = await fetch(url);
console.log(`status: ${r.status}`);
const body = (await r.json()) as {
  filing: { accession: string; cik: string; form: string | null; primaryDocUrl: string };
  items: Record<string, { title: string; text: string }>;
  meta: { parserVersion: string; itemCount: number; textLength: number; truncatedItems: string[] };
};
console.log(`filing:`, body.filing);
console.log(`meta:`, body.meta);
console.log(`item codes: ${Object.keys(body.items).join(", ")}`);
for (const [code, it] of Object.entries(body.items)) {
  console.log(`  Item ${code}: ${it.title}  (${it.text.length} chars)`);
  console.log(`    preview: ${it.text.slice(0, 200).replace(/\s+/g, " ")}`);
}
