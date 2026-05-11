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

const SITE_URL = "https://swarm-api.com";
const DASHBOARD_URL = process.env.DASHBOARD_URL ?? "http://localhost:3001";
const MARKETPLACE_URL = process.env.MARKETPLACE_URL ?? "http://localhost:3002";
const WHITEPAPER_URL = "https://www.x402.org/x402-whitepaper.pdf";
const X402_REPO_URL = "https://github.com/x402-foundation/x402";
const NPM_URL = "https://www.npmjs.com/package/@swarm-api/mcp";
const GITHUB_REPO_URL = "https://github.com/swarm-api-dev/swarm-api";
const GATEWAY_URL = "https://api.swarm-api.com";

const TOOLS: ReadonlyArray<{ name: string; description: string; priceUsd: string }> = [
  { name: "resolve_company", description: "Resolve ticker, CIK, or company name to a canonical SEC record.", priceUsd: "0.002" },
  { name: "list_filings", description: "List recent SEC filings filtered by form type and date.", priceUsd: "0.005" },
  { name: "extract_filing", description: "Parse 10-K, 10-Q, or 8-K into Item-level JSON.", priceUsd: "0.05" },
  { name: "insider_transactions", description: "Form 4 trades for officers, directors, 10% holders.", priceUsd: "0.03" },
  { name: "company_news", description: "Recent news articles via GDELT 2.0, default 30-day window.", priceUsd: "0.02" },
  { name: "company_jobs", description: "Open postings from public Greenhouse and Lever boards.", priceUsd: "0.01" },
  { name: "web_search", description: "General web search via the Brave Search API.", priceUsd: "0.01" },
  { name: "github_repo", description: "Stars, languages, license, last 10 commits, releases for a GitHub repo.", priceUsd: "0.005" },
  { name: "package_info", description: "npm/PyPI/cargo metadata plus OSV.dev CVE scan.", priceUsd: "0.005" },
];

function structuredData() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${SITE_URL}#organization`,
        name: "SwarmApi",
        url: SITE_URL,
        sameAs: [NPM_URL, GITHUB_REPO_URL, X402_REPO_URL],
        description:
          "Pay-per-call commerce platform for AI agents. Production endpoints settled in USDC on Base over the x402 protocol.",
      },
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}#website`,
        url: SITE_URL,
        name: "SwarmApi",
        publisher: { "@id": `${SITE_URL}#organization` },
        inLanguage: "en",
      },
      {
        "@type": "SoftwareApplication",
        "@id": `${SITE_URL}#mcp`,
        name: "@swarm-api/mcp",
        applicationCategory: "DeveloperApplication",
        operatingSystem: "macOS, Windows, Linux",
        description:
          "Model Context Protocol server exposing SwarmApi's nine paid endpoints as tools for Claude Desktop, Cursor, Continue, and other MCP hosts.",
        url: NPM_URL,
        downloadUrl: NPM_URL,
        softwareVersion: "0.1.5",
        offers: {
          "@type": "Offer",
          price: "0.00",
          priceCurrency: "USD",
          description: "Free MCP server. Per-call USDC pricing on the gateway.",
        },
      },
      ...TOOLS.map((t) => ({
        "@type": "Service",
        name: t.name,
        description: t.description,
        provider: { "@id": `${SITE_URL}#organization` },
        offers: {
          "@type": "Offer",
          price: t.priceUsd,
          priceCurrency: "USD",
          eligibleTransactionVolume: {
            "@type": "PriceSpecification",
            priceCurrency: "USDC",
          },
        },
      })),
      {
        "@type": "FAQPage",
        mainEntity: [
          {
            "@type": "Question",
            name: "How does an AI agent pay for an SwarmApi API call?",
            acceptedAnswer: {
              "@type": "Answer",
              text:
                "The agent makes a normal HTTP request. The gateway responds 402 Payment Required with payment terms. The @swarm-api/sdk signs an EIP-3009 USDC authorization off-chain and retries with one extra header. The gateway returns structured JSON and settles the USDC payment on Base mainnet.",
            },
          },
          {
            "@type": "Question",
            name: "Do I need an API key to use SwarmApi?",
            acceptedAnswer: {
              "@type": "Answer",
              text:
                "No. There are no API keys, signups, or contracts. The only credential is a Base wallet funded with USDC.",
            },
          },
          {
            "@type": "Question",
            name: "How do I fund the agent's wallet?",
            acceptedAnswer: {
              "@type": "Answer",
              text:
                "Three options. (1) Send USDC on Base from any wallet or exchange you already control — MetaMask, Coinbase withdraw-to-Base, Binance, Phantom, hardware wallet, corporate treasury. (2) Buy USDC on a retail app or exchange, then withdraw or send on Base to the address the setup CLI prints. (3) Bridge USDC from another chain to Base via Across, the official Base bridge, or any DEX aggregator. Coinbase Hosted Onramp card checkout needs your own CDP backend sessionToken — see Coinbase docs. The CLI watches the address and continues automatically once the deposit confirms.",
            },
          },
          {
            "@type": "Question",
            name: "What does a full company due-diligence pass cost?",
            acceptedAnswer: {
              "@type": "Answer",
              text:
                "About $0.13 in USDC for one full pass calling every endpoint once. Commercial equivalents like Crunchbase Enterprise start at $20,000 per year.",
            },
          },
          {
            "@type": "Question",
            name: "Which MCP hosts work with @swarm-api/mcp?",
            acceptedAnswer: {
              "@type": "Answer",
              text:
                "Claude Desktop, Cursor, Continue, and any host that supports the Model Context Protocol. The server is a standalone stdio process started by the host.",
            },
          },
        ],
      },
    ],
  };
}

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
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData()) }}
      />
      <header className="site">
        <div className="container">
          <a href="/" className="brand">
            <span className="brand-mark">A</span>
            SwarmApi
          </a>
          <nav className="site-nav">
            <a href={MARKETPLACE_URL}>Marketplace</a>
            <a href={DASHBOARD_URL}>Dashboard</a>
            <a href="/status">Status</a>
            <a href={NPM_URL} target="_blank" rel="noreferrer">
              npm
            </a>
            <a href={WHITEPAPER_URL} target="_blank" rel="noreferrer">
              Whitepaper
            </a>
          </nav>
        </div>
      </header>

      <section className="hero">
        <div className="container">
          <span className="eyebrow">Live · x402 · USDC on Base mainnet</span>
          <h1 className="hero-title">
            The first API marketplace your AI agent can{" "}
            <span className="accent">buy from on its own.</span>
          </h1>
          <p className="hero-subtitle">
            Nine production endpoints — SEC filings, real-time company news, insider trades,
            hiring signals, web search, GitHub health, package CVEs — settled per call in USDC on
            Base. No API keys, no contracts, no rate-limit emails. Drop the MCP server into
            Claude Desktop, fund a wallet, ship.
          </p>
          <div className="cta-row">
            <a href="#install" className="btn btn-primary">
              Install in 60 seconds →
            </a>
            <a href={MARKETPLACE_URL} className="btn">
              Browse the catalog
            </a>
            <a href={DASHBOARD_URL} className="btn">
              Live payments
            </a>
          </div>
          <p className="hero-foot">
            Built on the <a href={X402_REPO_URL} target="_blank" rel="noreferrer">x402 protocol</a>{" "}
            Coinbase shipped in 2025. Get in before the agents do.
          </p>
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
              <div className="stat-label">Endpoints live</div>
              <div className="stat-value">{stats.endpointCount}</div>
            </div>
          </div>
        </div>
      </section>

      <section className="block">
        <div className="container">
          <div className="section-eyebrow">Why this matters now</div>
          <h2 className="section-title">
            The data layer for agentic commerce. Most teams haven't noticed it shipped yet.
          </h2>
          <p className="section-lede">
            In 2025 Coinbase released x402 — a single HTTP status code that lets a server charge a
            client for one request, settled on-chain in seconds. Every AI agent vendor is rebuilding
            their tool stack on top of it. SwarmApi is what live agent traffic looks like on day
            one: production endpoints, real USDC settlement, zero subscriptions.
          </p>
          <div className="why-grid">
            <div className="why-card">
              <div className="icon">$</div>
              <h3>1,000× cheaper than a contract</h3>
              <p>
                A full company due-diligence pass — resolve, list filings, parse 10-K, news,
                insiders, jobs, GitHub — runs about <strong>$0.13</strong> in USDC. Crunchbase
                Enterprise starts at <strong>$20,000/year</strong> for less coverage. Run the math
                on a thousand companies.
              </p>
            </div>
            <div className="why-card">
              <div className="icon">⏱</div>
              <h3>Past your model's training cutoff</h3>
              <p>
                EDGAR filings indexed within minutes of publication. GDELT news refreshed every 15
                minutes. Job boards crawled hourly. Your agent never has to ask "is this still
                current" — the answer is always yes.
              </p>
            </div>
            <div className="why-card">
              <div className="icon">{`{ }`}</div>
              <h3>Built for tool-calling, not humans</h3>
              <p>
                10-K sections as JSON keys. Form 4 trades decoded from XML. News with extracted
                entities. Job postings with parsed seniority and stack. Designed for an LLM to
                consume in a single round-trip — not for a person with a browser tab.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="block">
        <div className="container">
          <div className="section-eyebrow">How it works</div>
          <h2 className="section-title">Three steps, one HTTP retry. That's the protocol.</h2>
          <p className="section-lede">
            x402 is small enough to read in five minutes and works with any client that can sign
            an EIP-3009 USDC authorization. The MCP server handles every byte of it.
          </p>
          <div className="flow">
            <div className="flow-step">
              <div className="num">1</div>
              <h3>Agent calls a tool</h3>
              <p>Plain HTTP GET or POST to one of the nine endpoints.</p>
              <code>GET /v1/companies/filings?id=0000320193</code>
            </div>
            <div className="flow-step">
              <div className="num">2</div>
              <h3>Gateway returns 402</h3>
              <p>
                Payment terms come back in the response: amount, asset, recipient address, chain.
                Six decimals of USDC, settled on Base mainnet.
              </p>
              <code>402 Payment Required</code>
            </div>
            <div className="flow-step">
              <div className="num">3</div>
              <h3>SDK signs and retries</h3>
              <p>
                @swarm-api/sdk signs the USDC authorization off-chain, retries with one header, gets
                the structured JSON back. The facilitator settles on-chain in the background.
              </p>
              <code>200 OK · structured JSON</code>
            </div>
          </div>
        </div>
      </section>

      <section className="block">
        <div className="container">
          <div className="section-eyebrow">What you can ask</div>
          <h2 className="section-title">Nine tools. One wallet. Real signals.</h2>
          <p className="section-lede">
            Each tool is an MCP function for Claude Desktop / Cursor / Continue, and a plain HTTP
            endpoint for everything else. Sources: SEC EDGAR, GDELT 2.0, Greenhouse, Lever,
            GitHub, npm, PyPI, cargo, OSV.dev, Brave Search — packaged into the JSON your agent
            actually needs.
          </p>
          <div className="audiences">
            <article className="audience">
              <span className="tag tag-providers">SEC + insiders</span>
              <h3>Ticker to risk factors to CEO trades.</h3>
              <p>
                EDGAR is free and the source of truth, but XBRL-shaped and slow to parse. We resolve
                tickers, list filings, extract 10-K/10-Q/8-K Items as JSON, and decode every Form 4
                insider trade for officers, directors, and 10% holders.
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
                  <span className="tool-desc">10-K / 10-Q / 8-K parsed to Item-level JSON.</span>
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
                GDELT 2.0 indexes most of the world's news every 15 minutes. Public ATS boards on
                Greenhouse and Lever expose hiring activity. Brave Search covers the long tail.
                Every signal is fresher than your model's cutoff.
              </p>
              <ul className="tool-list">
                <li>
                  <code className="tool-name">company_news</code>
                  <span className="tool-price">$0.02</span>
                  <span className="tool-desc">GDELT 2.0 articles, default 30-day window.</span>
                </li>
                <li>
                  <code className="tool-name">company_jobs</code>
                  <span className="tool-price">$0.01</span>
                  <span className="tool-desc">Open postings on Greenhouse + Lever.</span>
                </li>
                <li>
                  <code className="tool-name">web_search</code>
                  <span className="tool-price">$0.01</span>
                  <span className="tool-desc">General web search via Brave.</span>
                </li>
              </ul>
            </article>
            <article className="audience">
              <span className="tag tag-code">Code intelligence</span>
              <h3>What your coding agent needs to ship safely.</h3>
              <p>
                Every Cursor and Claude Code prompt is bottlenecked on the same question: is this
                dependency maintained, current, and free of CVEs? GitHub plus npm, PyPI, cargo, and
                OSV.dev — bundled into single calls so the agent stops guessing.
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
                Full due-diligence pass — every tool once — runs about <strong>$0.13</strong> per
                company. Compare your current data bill.
              </p>
            </article>
          </div>
        </div>
      </section>

      <section className="block" id="install">
        <div className="container">
          <div className="quickstart">
            <h2>Live in 60 seconds.</h2>
            <p>
              Generate a Base wallet, fund it with USDC on Base (send, exchange withdraw, or testnet
              faucet), write the Claude Desktop config — one CLI, no SwarmApi API key signup. Then
              restart Claude and ask anything.
            </p>

            <div className="install-step">
              <div className="step-num">1</div>
              <div className="step-body">
                <p className="step-title">Run the setup CLI:</p>
                <pre className="code config-block">{`$ npx -y @swarm-api/setup

Wallet source:
  [1] Generate a fresh Base wallet   (recommended)
  [2] Use an existing private key    (0x-prefixed hex)
  [3] Use an existing BIP-39 mnemonic (12 or 24 words)

> 1
✓ Generated wallet: 0xAB12…CD34
✓ Wallet saved to ~/.swarmapi/wallet.json (chmod 600)

How would you like to fund the wallet?
  [1] Send USDC on Base from any wallet or exchange  (recommended)
  [2] Open coinbase.com — buy USDC there, then Withdraw/Send on Base
  [3] Skip — I'll fund later (then run with --reuse)

> 1
Send any amount of USDC on Base mainnet to:
  0xAB12…CD34

Polling Base mainnet for USDC balance (Ctrl-C is safe — wallet saved):
✓ Detected 10.000000 USDC.
✓ MCP config written to ~/.swarmapi/claude-desktop.json`}</pre>
                <p className="muted">
                  <strong>Bring your own wallet, or generate a fresh one.</strong> The CLI accepts a
                  raw private key (<code>--key 0x...</code>), a 12 or 24-word BIP-39 mnemonic
                  (<code>--mnemonic "..."</code>), or generates one for you. The key is written to{" "}
                  <code>~/.swarmapi/wallet.json</code> (chmod 600) <em>before</em> any network
                  call — Ctrl-C during polling is always safe.
                </p>
                <p className="muted">
                  <strong>Three ways to fund — pick any one:</strong>
                </p>
                <ul className="fund-list">
                  <li>
                    <strong>Send on Base</strong> — the CLI prints your address and polls. Send USDC
                    on Base from MetaMask, Coinbase (Withdraw → Base), Binance, Phantom, a corporate
                    treasury, or a hardware wallet.
                  </li>
                  <li>
                    <strong>Buy then withdraw</strong> — purchase USDC on Coinbase or another
                    exchange and withdraw/send on Base to the printed address. Hosted card checkout
                    in Coinbase&apos;s widget requires a CDP{" "}
                    <code>sessionToken</code> from your backend (
                    <a
                      href="https://docs.cdp.coinbase.com/onramp/coinbase-hosted-onramp/generating-onramp-url"
                      target="_blank"
                      rel="noreferrer"
                    >
                      docs
                    </a>
                    ); this CLI does not embed that flow.
                  </li>
                  <li>
                    <strong>Bridge or swap</strong> — already hold ETH or USDC on another chain?
                    Bridge to Base via Across, the official Base bridge, or any DEX aggregator, then
                    send to the printed address.
                  </li>
                </ul>
                <p className="muted">
                  Power flags: <code>--reuse</code> (re-emit config for an existing wallet),{" "}
                  <code>--testnet</code> (Base Sepolia + Circle faucet), <code>--json</code>{" "}
                  (one-shot, scriptable for CI), <code>--no-poll</code>, <code>--no-open</code>,{" "}
                  <code>--gateway</code>, <code>--max-spend</code>. See{" "}
                  <code>npx -y @swarm-api/setup --help</code>.
                </p>
              </div>
            </div>

            <div className="install-step">
              <div className="step-num">2</div>
              <div className="step-body">
                <p className="step-title">Merge into Claude Desktop config and restart.</p>
                <p className="muted">
                  Open <code>~/Library/Application Support/Claude/claude_desktop_config.json</code>{" "}
                  (macOS) or <code>%APPDATA%\Claude\</code> (Windows). Paste the{" "}
                  <code>swarmapi</code> block from <code>~/.swarmapi/claude-desktop.json</code> into{" "}
                  <code>mcpServers</code>. Restart Claude.
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
                  Claude chains the right tools — <code>resolve_company</code> →{" "}
                  <code>list_filings</code> → <code>extract_filing</code> — and pays per call.
                  Default budget cap is $0.10 per request; agent refuses to sign anything above
                  that.
                </p>
              </div>
            </div>

            <h3 className="alt-heading">Or use the SDK directly</h3>
            <pre className="code">{`import { createAgentClient } from "@swarm-api/sdk";

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
                See the API catalog →
              </a>
              <a href={NPM_URL} target="_blank" rel="noreferrer" className="btn">
                @swarm-api/mcp on npm
              </a>
              <a href={X402_REPO_URL} target="_blank" rel="noreferrer" className="btn">
                x402 spec
              </a>
            </div>
          </div>
        </div>
      </section>

      <footer className="site">
        <div className="container">
          <div>
            Built on <a href={WHITEPAPER_URL} target="_blank" rel="noreferrer">x402</a> ·
            USDC settlement on Base mainnet · MIT license
          </div>
          <div className="links">
            <a href={MARKETPLACE_URL}>Marketplace</a>
            <a href={DASHBOARD_URL}>Dashboard</a>
            <a href="/status">Status</a>
            <a href={NPM_URL} target="_blank" rel="noreferrer">
              npm
            </a>
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
