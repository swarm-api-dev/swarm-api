import { asc } from "drizzle-orm";
import { endpoints, type Endpoint } from "@swarmapi/db";
import { getDb } from "../lib/db";

export const dynamic = "force-dynamic";

const USDC_DECIMALS = 6n;

function formatUsdc(atomic: string): string {
  try {
    const value = BigInt(atomic);
    const whole = value / 10n ** USDC_DECIMALS;
    const frac = value % 10n ** USDC_DECIMALS;
    const fracStr = frac.toString().padStart(6, "0").replace(/0+$/, "");
    return fracStr.length === 0 ? `$${whole}` : `$${whole}.${fracStr}`;
  } catch {
    return atomic;
  }
}

function snippet(e: Endpoint): string {
  const url = `${e.gatewayUrl}${e.resource}`;
  const cap = (BigInt(e.priceAtomic) * 10n).toString();
  return `import { createAgentClient } from "@swarmapi/sdk";

const fetch = createAgentClient({
  privateKey: process.env.AGENT_PRIVATE_KEY,
  maxSpendPerRequest: ${cap}n, // 10x list price
});

const res = await fetch("${url}");
const data = await res.json();`;
}

async function loadEndpoints(): Promise<Endpoint[]> {
  const db = getDb();
  return db.select().from(endpoints).orderBy(asc(endpoints.name)).all();
}

export default async function MarketplacePage() {
  const list = await loadEndpoints();

  return (
    <main>
      <h1>SwarmApi API catalog</h1>
      <p className="subtitle">
        Company intelligence for AI agents. Pay per call in USDC, no keys, no signups.
      </p>

      {list.length === 0 ? (
        <div className="empty">No endpoints registered yet. Start the gateway to seed the catalog.</div>
      ) : (
        <div className="cards">
          {list.map((e) => (
            <article className="card" key={e.id}>
              <header className="card-header">
                <h3 className="card-title">{e.name}</h3>
                <span className="price">{formatUsdc(e.priceAtomic)} / call</span>
              </header>
              {e.description ? <p className="description">{e.description}</p> : null}
              <dl className="meta">
                <dt>Endpoint</dt>
                <dd className="mono">
                  {e.method} {e.gatewayUrl}
                  {e.resource}
                </dd>
                <dt>Network</dt>
                <dd className="mono">{e.network}</dd>
                <dt>Asset</dt>
                <dd className="mono">{e.asset.slice(0, 6)}…{e.asset.slice(-4)} (USDC)</dd>
                <dt>Pay to</dt>
                <dd className="mono">{e.payTo.slice(0, 6)}…{e.payTo.slice(-4)}</dd>
              </dl>
              <pre className="snippet">{snippet(e)}</pre>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
