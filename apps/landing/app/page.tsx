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
          <span className="eyebrow">Built on x402 · Base · USDC</span>
          <h1 className="hero-title">
            Company intelligence, packaged for{" "}
            <span className="accent">AI agents</span>.
          </h1>
          <p className="hero-subtitle">
            SEC filings parsed to JSON, recent news indexed, hiring signals from public ATS boards.
            Fresh, structured, queryable in one HTTP call. Pay per call in USDC — no keys, no
            signups, no contracts.
          </p>
          <div className="cta-row">
            <a href={MARKETPLACE_URL} className="btn btn-primary">
              Browse the API catalog →
            </a>
            <a href={DASHBOARD_URL} className="btn">
              Live usage
            </a>
            <a href={WHITEPAPER_URL} target="_blank" rel="noreferrer" className="btn">
              x402 whitepaper
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
          <div className="section-eyebrow">Why agents pay for this</div>
          <h2 className="section-title">The data your agent needs after the training cutoff.</h2>
          <p className="section-lede">
            LLMs already know last year's facts. Agents fail on this quarter's filings, this week's
            news, today's job postings. AgentPay packages public sources into one HTTP surface so
            that gap closes in a single paid call.
          </p>
          <div className="why-grid">
            <div className="why-card">
              <div className="icon">⏱</div>
              <h3>Fresh past the cutoff</h3>
              <p>
                SEC filings within minutes of EDGAR publication. News indexed every 15 minutes.
                Job boards refreshed hourly. The agent never has to ask "is this still current?"
              </p>
            </div>
            <div className="why-card">
              <div className="icon">{`{ }`}</div>
              <h3>Structured for agents</h3>
              <p>
                10-K sections as JSON keys. News with extracted entities and sentiment. Job
                postings with parsed seniority and stack. Built for tool-calling, not for humans
                with a browser.
              </p>
            </div>
            <div className="why-card">
              <div className="icon">¢</div>
              <h3>Pay only for what you read</h3>
              <p>
                Per-call pricing from $0.002 to $0.05 in USDC. A full company due-diligence pass
                runs about $0.10. Crunchbase charges $20k a year for less.
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
              <h3>Agent asks a question</h3>
              <p>Plain HTTP request to a company-intelligence endpoint.</p>
              <code>GET /v1/companies/filings?id=AAPL</code>
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
              <p>SDK signs an EIP-3009 USDC authorization, retries with one header, gets data.</p>
              <code>200 OK + structured JSON</code>
            </div>
          </div>
        </div>
      </section>

      <section className="block">
        <div className="container">
          <div className="section-eyebrow">Behind the API</div>
          <h2 className="section-title">Public sources, agent-shaped.</h2>
          <p className="section-lede">
            We aggregate public, freely-licensed primary sources and ship them as structured JSON
            over a single x402 surface. No sublicensing tricks, no scraping behind paywalls — just
            engineering work to make data agents can actually use.
          </p>
          <div className="audiences">
            <article className="audience">
              <span className="tag tag-providers">SEC EDGAR</span>
              <h3>Filings, parsed.</h3>
              <p>
                10-K, 10-Q, 8-K, S-1, Form 4. EDGAR's APIs are free and comprehensive but
                XBRL-shaped. We resolve tickers, list filings by type and date, and return key
                sections as structured JSON.
              </p>
              <ul>
                <li>Resolve "AAPL" → CIK + canonical company record</li>
                <li>List recent filings filtered by form type and date</li>
                <li>Extract sections from a 10-K — risk factors, MD&A, financials</li>
                <li>Insider transactions decoded from raw Form 4</li>
              </ul>
              <pre className="code">
                <span className="k">await</span> fetch({"\n  "}
                <span className="s">
                  &quot;https://api.agentpay/v1/companies/filings?id=AAPL&types=10-K,8-K&quot;
                </span>
                {"\n});"}
              </pre>
            </article>
            <article className="audience">
              <span className="tag tag-agents">News + hiring signals</span>
              <h3>Fresh signals on every company.</h3>
              <p>
                GDELT 2.0 indexes essentially every news article published worldwide every 15
                minutes. Greenhouse and Lever expose every public job board as a clean JSON API.
                We query both per-company so the agent gets one structured answer.
              </p>
              <ul>
                <li>Recent news with extracted entities, themes, and tone</li>
                <li>Open job postings with parsed roles and locations</li>
                <li>Hiring trend over the last 30 / 90 / 365 days</li>
                <li>De-duplication across syndicated articles</li>
              </ul>
              <pre className="code">
                <span className="k">const</span> fetch = <span className="f">createAgentClient</span>(
                {"{\n  "}
                <span className="n">privateKey</span>: process.env.AGENT_PRIVATE_KEY,{"\n  "}
                <span className="n">maxSpendPerRequest</span>: <span className="s">50000n</span>,{" "}
                <span className="c">// $0.05 cap</span>
                {"\n});"}
              </pre>
            </article>
          </div>
        </div>
      </section>

      <section className="block">
        <div className="container">
          <div className="quickstart">
            <h2>Plug into your agent in five lines.</h2>
            <p>
              Hand the SDK a Base wallet and a budget cap. Every paid HTTP call resolves through
              the same client.
            </p>
            <div className="commands">
              <div>
                <span className="prompt">$</span>npm i @agentpay/sdk
              </div>
              <div>
                <span className="prompt">$</span>export AGENT_PRIVATE_KEY=0x...
              </div>
              <div>
                <span className="prompt">$</span>node -e &quot;
                <span style={{ color: "var(--purple)" }}>const</span> {"{ createAgentClient }"} ={" "}
                <span style={{ color: "var(--purple)" }}>require</span>(&apos;@agentpay/sdk&apos;);
                &quot;
              </div>
            </div>
            <div className="cta-row">
              <a href={MARKETPLACE_URL} className="btn btn-primary">
                See the API catalog
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
