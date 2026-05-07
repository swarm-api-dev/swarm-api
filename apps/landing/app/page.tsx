import { sql } from "drizzle-orm";
import { payments, endpoints } from "@agentpay/db";
import { getDb } from "../lib/db";

export const dynamic = "force-dynamic";

const USDC_DECIMALS = 6n;

function formatUsdc(atomic: string | null | undefined): string {
  const a = atomic ?? "0";
  try {
    const value = BigInt(a);
    const whole = value / 10n ** USDC_DECIMALS;
    const frac = value % 10n ** USDC_DECIMALS;
    const fracStr = frac.toString().padStart(6, "0").replace(/0+$/, "");
    return fracStr.length === 0 ? `$${whole}` : `$${whole}.${fracStr}`;
  } catch {
    return `$${a}`;
  }
}

async function loadStats() {
  const db = getDb();
  const settled = db
    .select({
      count: sql<number>`COUNT(*)`,
      sumAtomic: sql<string>`COALESCE(SUM(CAST(${payments.amountAtomic} AS INTEGER)), 0)`,
      uniquePayers: sql<number>`COUNT(DISTINCT ${payments.payerAddress})`,
    })
    .from(payments)
    .where(sql`${payments.status} = 'settled'`)
    .all();
  const endpointCount = db
    .select({ count: sql<number>`COUNT(*)` })
    .from(endpoints)
    .all();

  return {
    settledCount: Number(settled[0]?.count ?? 0),
    revenueAtomic: String(settled[0]?.sumAtomic ?? 0),
    uniquePayers: Number(settled[0]?.uniquePayers ?? 0),
    endpointCount: Number(endpointCount[0]?.count ?? 0),
  };
}

const DASHBOARD_URL = process.env.DASHBOARD_URL ?? "http://localhost:3001";
const MARKETPLACE_URL = process.env.MARKETPLACE_URL ?? "http://localhost:3002";
const WHITEPAPER_URL = "https://www.x402.org/x402-whitepaper.pdf";
const X402_REPO_URL = "https://github.com/x402-foundation/x402";

export default async function LandingPage() {
  const stats = await loadStats();

  return (
    <>
      <header className="site">
        <div className="container">
          <a href="/" className="brand">
            <span className="brand-mark">A</span>
            AgentPay
          </a>
          <nav className="site-nav">
            <a href={MARKETPLACE_URL}>Marketplace</a>
            <a href={DASHBOARD_URL}>Dashboard</a>
            <a href={WHITEPAPER_URL} target="_blank" rel="noreferrer">
              Whitepaper
            </a>
            <a href={X402_REPO_URL} target="_blank" rel="noreferrer">
              x402 spec
            </a>
          </nav>
        </div>
      </header>

      <section className="hero">
        <div className="container">
          <span className="eyebrow">Built on x402 · Base Sepolia</span>
          <h1 className="hero-title">
            Monetize your API for <span className="accent">AI agents</span> in one hour.
          </h1>
          <p className="hero-subtitle">
            Add x402 payment gating with one line of middleware. Charge per request in USDC. No API
            keys, no subscriptions, no chargebacks — just signed HTTP requests that pay themselves.
          </p>
          <div className="cta-row">
            <a href={MARKETPLACE_URL} className="btn btn-primary">
              Browse the marketplace →
            </a>
            <a href={DASHBOARD_URL} className="btn">
              Open dashboard
            </a>
            <a href={WHITEPAPER_URL} target="_blank" rel="noreferrer" className="btn">
              Read the whitepaper
            </a>
          </div>
        </div>
      </section>

      <section className="stats-strip">
        <div className="container">
          <div className="stats-card">
            <div className="live-pill">
              <span className="live-dot" />
              live
            </div>
            <div className="stat">
              <div className="stat-label">Revenue settled</div>
              <div className="stat-value">{formatUsdc(stats.revenueAtomic)}</div>
            </div>
            <div className="stat">
              <div className="stat-label">Paid calls</div>
              <div className="stat-value">{stats.settledCount}</div>
            </div>
            <div className="stat">
              <div className="stat-label">Unique payers</div>
              <div className="stat-value">{stats.uniquePayers}</div>
            </div>
            <div className="stat">
              <div className="stat-label">Endpoints listed</div>
              <div className="stat-value">{stats.endpointCount}</div>
            </div>
          </div>
        </div>
      </section>

      <section className="block">
        <div className="container">
          <div className="section-eyebrow">Why x402</div>
          <h2 className="section-title">Designed for machines, not checkout flows.</h2>
          <p className="section-lede">
            HTTP 402 has been reserved for "payment required" since 1992. x402 finally puts it to
            work — letting servers price each request and clients pay automatically with stablecoins.
          </p>
          <div className="why-grid">
            <div className="why-card">
              <div className="icon">⚡</div>
              <h3>Instant settlement</h3>
              <p>
                Payments finalize on Base in roughly 200 milliseconds. No batch windows, no rolling
                chargebacks, no waiting on a payment processor.
              </p>
            </div>
            <div className="why-card">
              <div className="icon">¢</div>
              <h3>Per-request pricing</h3>
              <p>
                Stablecoin gas fees under a tenth of a cent unlock real micropayments. Charge $0.001
                per call, $0.005 per inference, $0.10 per document.
              </p>
            </div>
            <div className="why-card">
              <div className="icon">🤖</div>
              <h3>Machine-native</h3>
              <p>
                No accounts, no API keys, no human approval steps. An autonomous agent finds your
                endpoint, signs a USDC authorization, and gets a response — all in one HTTP retry.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="block">
        <div className="container">
          <div className="section-eyebrow">How it works</div>
          <h2 className="section-title">Three steps, one HTTP retry.</h2>
          <p className="section-lede">
            The whole protocol fits in a sequence diagram. Your code only deals with steps 1 and 3.
          </p>
          <div className="flow">
            <div className="flow-step">
              <div className="num">1</div>
              <h3>Agent makes a request</h3>
              <p>Standard HTTP GET against your monetized endpoint.</p>
              <code>GET /api/example</code>
            </div>
            <div className="flow-step">
              <div className="num">2</div>
              <h3>Server returns 402</h3>
              <p>The gateway answers with payment terms — amount, asset, recipient, network.</p>
              <code>402 Payment Required</code>
            </div>
            <div className="flow-step">
              <div className="num">3</div>
              <h3>Agent signs & retries</h3>
              <p>SDK signs an EIP-3009 USDC transfer authorization and retries with one header.</p>
              <code>200 OK + receipt</code>
            </div>
          </div>
        </div>
      </section>

      <section className="block">
        <div className="container">
          <div className="section-eyebrow">Two sides</div>
          <h2 className="section-title">Built for both ends of the wire.</h2>
          <p className="section-lede">
            AgentPay packages the x402 protocol with a payment-event database, an operator
            dashboard, and an agent-discoverable marketplace.
          </p>
          <div className="audiences">
            <article className="audience">
              <span className="tag tag-providers">For API providers</span>
              <h3>Add a price tag, get paid in USDC.</h3>
              <p>
                One middleware call gates an endpoint. Configure price, network, and payout address;
                AgentPay records every paid call and surfaces revenue on the dashboard.
              </p>
              <ul>
                <li>Drop-in Express middleware on Base Sepolia or mainnet</li>
                <li>Per-request pricing in USDC, no credit-card stack to maintain</li>
                <li>Live dashboard: revenue, settled vs failed, success rate</li>
                <li>Listings auto-published to the marketplace</li>
              </ul>
              <pre className="code">
                <span className="k">app</span>.use(
                {"\n  "}
                <span className="f">paymentMiddleware</span>(<span className="n">routes</span>,{" "}
                <span className="n">resourceServer</span>),{"\n"});
              </pre>
            </article>
            <article className="audience">
              <span className="tag tag-agents">For AI agents</span>
              <h3>Pay for tools your agent actually uses.</h3>
              <p>
                Drop in <code>@agentpay/sdk</code>, hand it a wallet and a budget cap. It handles
                the 402 → sign → retry loop and refuses anything over your spend limit.
              </p>
              <ul>
                <li>fetch-compatible client, no integration work in your loop</li>
                <li>Per-request budget cap throws BudgetExceededError on overrun</li>
                <li>Spend logs flow into the same dashboard</li>
                <li>Browse paid APIs in the marketplace, copy a snippet, run</li>
              </ul>
              <pre className="code">
                <span className="k">const</span> fetch = <span className="f">createAgentClient</span>(
                {"{\n  "}
                <span className="n">privateKey</span>: process.env.AGENT_PRIVATE_KEY,{"\n  "}
                <span className="n">maxSpendPerRequest</span>: <span className="s">10000n</span>,
                {"\n});"}
              </pre>
            </article>
          </div>
        </div>
      </section>

      <section className="block">
        <div className="container">
          <div className="quickstart">
            <h2>Run the whole stack locally.</h2>
            <p>
              Gateway, SDK, payment DB, dashboard, and marketplace — same monorepo, one install.
            </p>
            <div className="commands">
              <div>
                <span className="prompt">$</span>git clone agentpay && cd agentpay
              </div>
              <div>
                <span className="prompt">$</span>npm install
              </div>
              <div>
                <span className="prompt">$</span>npm run dev -w @agentpay/gateway
              </div>
              <div>
                <span className="prompt">$</span>npm run dev -w @agentpay/dashboard
              </div>
            </div>
            <div className="cta-row">
              <a href={MARKETPLACE_URL} className="btn btn-primary">
                See the marketplace
              </a>
              <a href={X402_REPO_URL} target="_blank" rel="noreferrer" className="btn">
                x402-foundation on GitHub
              </a>
            </div>
          </div>
        </div>
      </section>

      <footer className="site">
        <div className="container">
          <div>
            Built on the{" "}
            <a href={WHITEPAPER_URL} target="_blank" rel="noreferrer">
              x402 protocol
            </a>{" "}
            · USDC settlement on Base
          </div>
          <div className="links">
            <a href={MARKETPLACE_URL}>Marketplace</a>
            <a href={DASHBOARD_URL}>Dashboard</a>
            <a href={WHITEPAPER_URL} target="_blank" rel="noreferrer">
              Whitepaper
            </a>
            <a href={X402_REPO_URL} target="_blank" rel="noreferrer">
              x402 spec
            </a>
          </div>
        </div>
      </footer>
    </>
  );
}
