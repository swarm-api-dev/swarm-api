import { fetchStats } from "../lib/api";

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

const DASHBOARD_URL = process.env.DASHBOARD_URL ?? "http://localhost:3001";
const MARKETPLACE_URL = process.env.MARKETPLACE_URL ?? "http://localhost:3002";
const WHITEPAPER_URL = "https://www.x402.org/x402-whitepaper.pdf";
const X402_REPO_URL = "https://github.com/x402-foundation/x402";

export default async function LandingPage() {
  const stats = await fetchStats().catch(() => ({
    settledCount: 0,
    failedCount: 0,
    revenueAtomic: "0",
    uniquePayers: 0,
    endpointCount: 0,
  }));

  return (
    <>
      <header className="site">
        <div className="container">
          <a href="/" className="brand">
            <span className="brand-mark">A</span>
            SwarmApi
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
          <span className="eyebrow">MCP server · Base · USDC</span>
          <h1 className="hero-title">
            Real-world data as MCP tools your <span className="accent">agent calls itself</span>.
          </h1>
          <p className="hero-subtitle">
            Nine paid endpoints — SEC filings, news, hiring, insider trades, web search, GitHub
            repos, package metadata. Drop a config block into Claude Desktop, fund a Base wallet,
            and your agent pays per call in USDC. No API keys, no signups, no contracts.
          </p>
          <div className="cta-row">
            <a href="#install" className="btn btn-primary">
              Install for Claude Desktop →
            </a>
            <a href={MARKETPLACE_URL} className="btn">
              API catalog
            </a>
            <a href={DASHBOARD_URL} className="btn">
              Live usage
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
            news, today's job postings. SwarmApi packages public sources into one HTTP surface so
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
              <p>Plain HTTP request to any of the 9 endpoints.</p>
              <code>GET /v1/github/repo?slug=facebook/react</code>
            </div>
            <div className="flow-step">
              <div className="num">2</div>
              <h3>Server returns 402</h3>
              <p>The gateway answers with payment terms — amount, asset, recipient, network.</p>
              <code>402 Payment Required</code>
            </div>
            <div className="flow-step">
              <div className="num">3</div>
              <h3>MCP server signs & retries</h3>
              <p>
                @swarmapi/mcp signs an EIP-3009 USDC authorization, retries with one header, returns
                the JSON to your agent — no protocol code in the agent loop.
              </p>
              <code>200 OK + structured JSON</code>
            </div>
          </div>
        </div>
      </section>

      <section className="block">
        <div className="container">
          <div className="section-eyebrow">What you can ask</div>
          <h2 className="section-title">Nine tools, one wallet.</h2>
          <p className="section-lede">
            Each is an MCP tool for Claude Desktop / Cursor / any MCP host, and a plain x402 HTTP
            endpoint for everyone else. Sources are public — SEC EDGAR, GDELT, Greenhouse, Lever,
            GitHub, npm/PyPI/cargo, OSV.dev, Brave Search — engineered into JSON agents can consume.
          </p>
          <div className="audiences">
            <article className="audience">
              <span className="tag tag-providers">SEC + insiders</span>
              <h3>From ticker to risk factors to officer trades.</h3>
              <p>
                EDGAR is free and comprehensive but XBRL-shaped. We resolve tickers, list filings,
                parse 10-K/10-Q/8-K filings into per-Item JSON, and decode Form 4 insider trades.
              </p>
              <ul className="tool-list">
                <li>
                  <code className="tool-name">resolve_company</code>
                  <span className="tool-price">$0.002</span>
                  <span className="tool-desc">Ticker / CIK / name → canonical SEC record.</span>
                </li>
                <li>
                  <code className="tool-name">list_filings</code>
                  <span className="tool-price">$0.005</span>
                  <span className="tool-desc">Recent filings filtered by form type and date.</span>
                </li>
                <li>
                  <code className="tool-name">extract_filing</code>
                  <span className="tool-price">$0.05</span>
                  <span className="tool-desc">10-K / 10-Q / 8-K → Item-level structured JSON.</span>
                </li>
                <li>
                  <code className="tool-name">insider_transactions</code>
                  <span className="tool-price">$0.03</span>
                  <span className="tool-desc">Form 4 trades for officers, directors, 10% holders.</span>
                </li>
              </ul>
            </article>
            <article className="audience">
              <span className="tag tag-agents">Real-time signals</span>
              <h3>What the model couldn't memorise.</h3>
              <p>
                GDELT 2.0 indexes most of the world's news every 15 minutes. Public Greenhouse and
                Lever boards expose hiring activity. Brave Search covers everything else.
              </p>
              <ul className="tool-list">
                <li>
                  <code className="tool-name">company_news</code>
                  <span className="tool-price">$0.02</span>
                  <span className="tool-desc">Recent articles via GDELT, default 30-day window.</span>
                </li>
                <li>
                  <code className="tool-name">company_jobs</code>
                  <span className="tool-price">$0.01</span>
                  <span className="tool-desc">Open postings from Greenhouse + Lever boards.</span>
                </li>
                <li>
                  <code className="tool-name">web_search</code>
                  <span className="tool-price">$0.01</span>
                  <span className="tool-desc">General web search via the Brave Search API.</span>
                </li>
              </ul>
            </article>
            <article className="audience">
              <span className="tag tag-code">Code intelligence</span>
              <h3>What your coding agent needs to ship safely.</h3>
              <p>
                The data Cursor and Claude Code reach for every prompt: is this repo maintained? Is
                this dependency current and free of CVEs? GitHub + npm + PyPI + cargo + OSV.dev,
                bundled into single calls.
              </p>
              <ul className="tool-list">
                <li>
                  <code className="tool-name">github_repo</code>
                  <span className="tool-price">$0.005</span>
                  <span className="tool-desc">Stars, languages, license, last 10 commits, releases.</span>
                </li>
                <li>
                  <code className="tool-name">package_info</code>
                  <span className="tool-price">$0.005</span>
                  <span className="tool-desc">npm/PyPI/cargo metadata + OSV.dev CVE scan.</span>
                </li>
              </ul>
              <p className="callout">
                A full due-diligence pass — every tool fired once — costs about{" "}
                <strong>$0.13</strong> per company.
              </p>
            </article>
          </div>
        </div>
      </section>

      <section className="block" id="install">
        <div className="container">
          <div className="quickstart">
            <h2>Drop into Claude Desktop in one command.</h2>
            <p>
              Generate a Base wallet, fund it with a credit card via Coinbase Onramp, write the
              Claude Desktop config — all from one CLI. Then restart Claude and ask anything.
            </p>

            <div className="install-step">
              <div className="step-num">1</div>
              <div className="step-body">
                <p className="step-title">Run the setup CLI:</p>
                <pre className="code config-block">{`$ npx -y @swarmapi/setup

✓ Generated wallet: 0xAB12…CD34
? How would you like to fund it?
  > Buy USDC with card via Coinbase Onramp
✓ Detected 10.000000 USDC.
✓ Saved Claude Desktop config to ~/.swarmapi/claude-desktop.json`}</pre>
                <p className="muted">
                  No API keys, no signups. The CLI never touches your card — the Coinbase-hosted
                  Onramp page handles purchase + KYC, then deposits USDC to your fresh wallet.
                </p>
              </div>
            </div>

            <div className="install-step">
              <div className="step-num">2</div>
              <div className="step-body">
                <p className="step-title">Merge into Claude Desktop config and restart.</p>
                <p className="muted">
                  Open <code>~/Library/Application Support/Claude/claude_desktop_config.json</code>{" "}
                  (or <code>%APPDATA%\Claude\</code> on Windows), paste the <code>swarmapi</code>{" "}
                  block from <code>~/.swarmapi/claude-desktop.json</code> into{" "}
                  <code>mcpServers</code>, and restart Claude Desktop.
                </p>
              </div>
            </div>

            <div className="install-step">
              <div className="step-num">3</div>
              <div className="step-body">
                <p className="step-title">Ask Claude anything about a public company.</p>
                <p className="muted">
                  <em>"Pull the latest 8-K filings for AAPL and summarise the material events."</em>
                </p>
                <p className="muted">
                  Claude picks the right tools (<code>resolve_company</code> →{" "}
                  <code>list_filings</code> → <code>extract_filing</code>) and pays per call.
                  Default budget cap is $0.10 per request — agent stops if it tries to exceed it.
                </p>
              </div>
            </div>

            <h3 className="alt-heading">Or use the SDK directly</h3>
            <pre className="code">{`import { createAgentClient } from "@swarmapi/sdk";

const fetch = createAgentClient({
  privateKey: process.env.AGENT_PRIVATE_KEY,
  maxSpendPerRequest: 100_000n, // $0.10 cap
});

const res = await fetch(
  "https://api.swarm-api.com/v1/companies/filings?id=0000320193"
);
const filings = (await res.json()).filings;`}</pre>

            <div className="cta-row install-ctas">
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
