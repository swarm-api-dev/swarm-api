import { fetchStats } from "../lib/api";
import { SiteFooter } from "./components/SiteFooter";
import { SiteHeader } from "./components/SiteHeader";
import {
  SITE_URL,
  GATEWAY_URL,
  DASHBOARD_URL,
  MARKETPLACE_URL,
  X402_WHITEPAPER_PDF,
  X402_REPO_URL,
  NPM_URL,
  NPM_SETUP_URL,
  NPM_SDK_URL,
  SMITHERY_SERVER_URL,
  GITHUB_REPO_URL,
} from "../lib/site";

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

const TOOLS_BY_PRICE = [...TOOLS].sort((a, b) => Number(a.priceUsd) - Number(b.priceUsd));
const PRICE_SPAN = `$${TOOLS_BY_PRICE[0].priceUsd}–$${TOOLS_BY_PRICE[TOOLS_BY_PRICE.length - 1].priceUsd}`;

/** Representative live 402 from GET /v1/github/repo (truncated Payment-Required payload). */
const CURL_SAMPLE = `curl -i "${GATEWAY_URL}/v1/github/repo?slug=facebook/react"

HTTP/1.1 402 Payment Required
Content-Type: application/json; charset=utf-8
Payment-Required: eyJ4NDAyVmVyc2lvbiI6MiwiZXJyb3IiOiJQYXltZW50IHJlcXVpcmVkIi…

{}`;

function structuredData() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${SITE_URL}#organization`,
        name: "SwarmApi",
        url: SITE_URL,
        sameAs: [NPM_URL, NPM_SETUP_URL, GITHUB_REPO_URL, SMITHERY_SERVER_URL, X402_REPO_URL],
        description:
          "Structured JSON APIs for agents — SEC, news, jobs, search, GitHub, CVEs — via MCP or HTTP SDK. Per-call USDC on Base (x402). No vendor API keys.",
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
          "Model Context Protocol server for Claude Desktop, Cursor, Continue, and other MCP hosts. Nine paid gateway tools plus free gateway_ping and gateway_catalog (health + catalog, no USDC).",
        url: NPM_URL,
        downloadUrl: NPM_URL,
        softwareVersion: "0.1.8",
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
            name: "What is SwarmApi?",
            acceptedAnswer: {
              "@type": "Answer",
              text:
                "SwarmApi is a live HTTP gateway of structured JSON APIs (SEC filings, news, jobs, web search, GitHub repo signals, package CVEs) built for tool-calling AI agents. You connect through the @swarm-api/mcp server or call the same routes with @swarm-api/sdk. Each successful response is paid in USDC on Base using the x402 protocol — HTTP 402 plus an EIP-3009 authorization — instead of vendor API keys.",
            },
          },
          {
            "@type": "Question",
            name: "Do I need the MCP server or the SDK?",
            acceptedAnswer: {
              "@type": "Answer",
              text:
                "Use @swarm-api/mcp inside Cursor, Claude Desktop, Continue, or any MCP host so the model invokes tools directly. Use @swarm-api/sdk for backends, scripts, and services that speak HTTP. Both hit the same gateway at api.swarm-api.com.",
            },
          },
          {
            "@type": "Question",
            name: "Is there a free way to try the MCP server?",
            acceptedAnswer: {
              "@type": "Answer",
              text:
                "Yes. Omit SWARMAPI_PRIVATE_KEY and the MCP server exposes only gateway_ping (GET /health) and gateway_catalog (GET /v1/catalog) — no USDC required. Use that to verify wiring before funding a wallet for paid tools.",
            },
          },
          {
            "@type": "Question",
            name: "How does an AI agent pay for a SwarmApi API call?",
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
  const stats = await fetchStats();

  const endpointLive = stats.endpointCount > 0 ? stats.endpointCount : TOOLS.length;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData()) }}
      />
      <SiteHeader />

      <section className="hero">
        <div className="container">
          <div className="hero-layout">
            <div className="hero-copy">
              <span className="eyebrow">Live · USDC on Base · x402</span>
              <h1 className="hero-title">
                Structured APIs for agents.
                <br />
                <span className="accent">Priced per call.</span>
              </h1>
              <p className="hero-subtitle">
                SEC filings, news, hiring, web search, GitHub health, and package CVEs — returned as
                JSON your model can use. Connect with MCP or call the same routes over HTTP with the
                TypeScript SDK.
              </p>
              <ul className="surface-list">
                <li>
                  <strong>MCP:</strong> <code>@swarm-api/mcp</code> for Cursor, Claude Desktop, Continue.
                </li>
                <li>
                  <strong>HTTP + SDK:</strong> <code>@swarm-api/sdk</code> for backends and scripts.
                </li>
                <li>
                  <strong>Payment:</strong> per successful response in USDC via x402 (no vendor API keys).
                </li>
              </ul>
              <p className="hero-metrics">
                {endpointLive} production tools · {PRICE_SPAN} per call · wallet is the only credential
              </p>
              <div className="cta-row">
                <a href="#install" className="btn btn-primary">
                  Install →
                </a>
                <a href={MARKETPLACE_URL} className="btn">
                  Catalog &amp; schemas
                </a>
                <a href={NPM_SETUP_URL} target="_blank" rel="noreferrer" className="btn">
                  npm setup
                </a>
              </div>
              <p className="hero-foot">
                Gateway:{" "}
                <a href={GATEWAY_URL} target="_blank" rel="noreferrer">
                  api.swarm-api.com
                </a>
                . Hosted MCP registry:{" "}
                <a href={SMITHERY_SERVER_URL} target="_blank" rel="noreferrer">
                  Smithery — swarm-api/swarmapi
                </a>{" "}
                (<span className="mono">{SMITHERY_SERVER_URL}</span>). Protocol:{" "}
                <a href={X402_REPO_URL} target="_blank" rel="noreferrer">
                  x402
                </a>
                .
              </p>
            </div>
            <div className="curl-card" aria-label="Example unauthenticated gateway response">
              <div className="curl-card-label">Proof · raw HTTP (try it)</div>
              <pre className="curl-sample">{CURL_SAMPLE}</pre>
              <p className="curl-card-foot muted">
                Unauthenticated clients get <strong className="curl-hl">402</strong> with a{" "}
                <code>Payment-Required</code> payload (amount in atomic USDC, Base payee). Decode the
                header or pay through the SDK/MCP.
              </p>
            </div>
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
              <div className="stat-label">Endpoints live</div>
              <div className="stat-value">{stats.endpointCount || TOOLS.length}</div>
            </div>
          </div>
          <p className="stats-caption">
            Public aggregate metrics — no customer PII. Zeros only mean limited traffic on this slice,
            not that payments are disabled.
          </p>
        </div>
      </section>

      <section className="block">
        <div className="container">
          <div className="chapter-heading">
            <span className="chapter-num">[01]</span>
            <div className="section-eyebrow" style={{ marginBottom: 0 }}>
              What you get
            </div>
          </div>
          <h2 className="section-title">Two surfaces. One gateway.</h2>
          <p className="section-lede">
            Pick MCP for chat-native agents, or the SDK for anything that already speaks HTTP.
          </p>
          <div className="surface-grid">
            <div className="surface-tile">
              <h3>Agent tools (MCP)</h3>
              <p>
                Install <code>@swarm-api/mcp</code>. The host exposes nine paid tools that map 1:1 to
                gateway routes. Optional free probes: <code>gateway_ping</code>,{" "}
                <code>gateway_catalog</code> (no wallet).
              </p>
            </div>
            <div className="surface-tile">
              <h3>HTTP API + TypeScript SDK</h3>
              <p>
                Call <code>{GATEWAY_URL}</code> directly or wrap it with{" "}
                <code>@swarm-api/sdk</code> — automatic 402 handling, signing, and retries.
              </p>
            </div>
            <div className="surface-tile">
              <h3>Pay when data returns</h3>
              <p>
                x402 turns payment into part of the HTTP round-trip.{" "}
                <a href="#how-payment-works">How payment works →</a>
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="block">
        <div className="container">
          <div className="chapter-heading">
            <span className="chapter-num">[02]</span>
            <div className="section-eyebrow" style={{ marginBottom: 0 }}>
              Why teams use SwarmApi
            </div>
          </div>
          <h2 className="section-title">Built for agents shipping real work.</h2>
          <p className="section-lede">
            Cheaper than enterprise data contracts when you meter by the task — not by the seat year.
          </p>
          <div className="benefits-grid">
            <div className="why-card">
              <div className="icon">$</div>
              <h3>Per-call vs. shelfware subscriptions</h3>
              <p>
                A full company pass — every tool once — is about <strong>$0.13</strong> USDC.
                Enterprise comps often start at five figures a year for slower-moving bundles.
              </p>
            </div>
            <div className="why-card">
              <div className="icon">⏱</div>
              <h3>Fresher than the training cutoff</h3>
              <p>
                EDGAR indexing, GDELT-sized news windows, public job boards — structured so the model
                stops guessing whether a fact is stale.
              </p>
            </div>
            <div className="why-card">
              <div className="icon">🔑</div>
              <h3>No API keys</h3>
              <p>
                Fund a Base wallet with USDC. That wallet signs each micropayment — no signup wall,
                no rotating secrets in env vars for vendors.
              </p>
            </div>
            <div className="why-card">
              <div className="icon">{`{ }`}</div>
              <h3>JSON for tool-calling</h3>
              <p>
                Filings, insiders, articles, jobs, repo stats, CVE summaries — shapes meant for LLM
                consumption, not spreadsheet export.
              </p>
            </div>
            <div className="why-card">
              <div className="icon">⌘</div>
              <h3>Cursor- and Claude-ready</h3>
              <p>
                Same MCP config pattern as other production servers; ship prompts that chain resolve →
                filings → extract without custom middleware.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="block">
        <div className="container">
          <div className="chapter-heading">
            <span className="chapter-num">[03]</span>
            <div className="section-eyebrow" style={{ marginBottom: 0 }}>
              Catalog
            </div>
          </div>
          <h2 className="section-title">Nine paid tools. Grouped by job-to-be-done.</h2>
          <p className="section-lede">
            Full JSON schemas and examples live in the Marketplace. MCP tool names match the rows below.
          </p>

          <p className="prompt-examples">
            <strong>Example prompts:</strong> “Summarize material risks from AAPL&apos;s latest 10-K
            Item 1A.” · “What insider Form 4 activity hit NVDA this quarter?” · “Is{" "}
            <code>facebook/react</code> actively maintained and any critical CVEs on its npm deps?”
          </p>

          <p className="muted" style={{ margin: "0 0 16px", fontSize: 14 }}>
            MCP-only free helpers (omit <code>SWARMAPI_PRIVATE_KEY</code>):{" "}
            <code>gateway_ping</code> → <code>GET /health</code>, <code>gateway_catalog</code> →{" "}
            <code>GET /v1/catalog</code>.
          </p>

          <div className="catalog-table-wrap">
            <table className="catalog-table">
              <thead>
                <tr>
                  <th>Tool</th>
                  <th>Price</th>
                  <th>What it returns</th>
                </tr>
              </thead>
              <tbody>
                {TOOLS_BY_PRICE.map((t) => (
                  <tr key={t.name}>
                    <td>
                      <code>{t.name}</code>
                    </td>
                    <td className="cat-price">${t.priceUsd}</td>
                    <td>{t.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="audiences">
            <article className="audience">
              <span className="tag tag-providers">SEC + insiders</span>
              <h3>Ticker → filings → narrative.</h3>
              <p>
                Resolve symbols to CIK, walk recent filings, lift 10-K / 10-Q / 8-K Items into JSON,
                decode Form 4 insider flows.
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
              <span className="tag tag-agents">Signals</span>
              <h3>News, hiring, open web.</h3>
              <p>
                GDELT-backed news, Greenhouse/Lever job boards where exposed, Brave-backed web search
                for the long tail query.
              </p>
              <ul className="tool-list">
                <li>
                  <code className="tool-name">company_news</code>
                  <span className="tool-price">$0.02</span>
                  <span className="tool-desc">Articles, default 30-day window.</span>
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
              <h3>Repo health &amp; supply chain.</h3>
              <p>
                Snapshot GitHub activity and inventory npm/PyPI/cargo packages with OSV.dev CVE
                context — one round-trip each.
              </p>
              <ul className="tool-list">
                <li>
                  <code className="tool-name">github_repo</code>
                  <span className="tool-price">$0.005</span>
                  <span className="tool-desc">Stars, languages, license, commits, releases.</span>
                </li>
                <li>
                  <code className="tool-name">package_info</code>
                  <span className="tool-price">$0.005</span>
                  <span className="tool-desc">Registry metadata + OSV.dev CVE scan.</span>
                </li>
              </ul>
              <p className="callout">
                Full due-diligence pass — every paid tool once — about <strong>$0.13</strong> USDC.
              </p>
            </article>
          </div>
        </div>
      </section>

      <section className="block" id="how-payment-works">
        <div className="container">
          <div className="chapter-heading">
            <span className="chapter-num">[04]</span>
            <div className="section-eyebrow" style={{ marginBottom: 0 }}>
              Protocol
            </div>
          </div>
          <h2 className="section-title">Four beats: request, challenge, sign, settle.</h2>
          <p className="section-lede">
            x402 keeps settlement on Base while your integration stays plain HTTP + one signed header
            on retry.
          </p>
          <div className="flow">
            <div className="flow-step">
              <div className="num">1</div>
              <h3>Request</h3>
              <p>Agent calls the gateway — same verbs and paths as the MCP tool names imply.</p>
              <code>GET /v1/github/repo?slug=owner/repo</code>
            </div>
            <div className="flow-step">
              <div className="num">2</div>
              <h3>Challenge</h3>
              <p>
                Gateway answers <strong>402 Payment Required</strong> with machine-readable terms (
                <code>Payment-Required</code> header / payload).
              </p>
              <code>402 + accepts[] · amount · asset · payTo</code>
            </div>
            <div className="flow-step">
              <div className="num">3</div>
              <h3>Sign</h3>
              <p>
                SDK or MCP runner signs an EIP-3009 USDC authorization for that quote and attaches it
                on retry.
              </p>
              <code>X-Payment: …</code>
            </div>
            <div className="flow-step">
              <div className="num">4</div>
              <h3>Settle + respond</h3>
              <p>
                Gateway verifies, returns structured JSON, and the facilitator completes USDC
                settlement on Base.
              </p>
              <code>200 OK · application/json</code>
            </div>
          </div>

          <details className="landing-details">
            <summary>Technical details (EIP-3009 &amp; facilitator)</summary>
            <div className="details-body">
              <p>
                Authorizations follow ERC-3009 <code>transferWithAuthorization</code>, letting the
                payer approve an atomic transfer referenced by the payment payload — no on-chain tx
                from your hot path before the retry. Coinbase CDP facilitates settlement on Base;
                USDC contract <code>0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913</code>. Read the{" "}
                <a href={X402_WHITEPAPER_PDF} target="_blank" rel="noreferrer">
                  x402 whitepaper (PDF)
                </a>{" "}
                for the full handshake.
              </p>
            </div>
          </details>
        </div>
      </section>

      <section className="block">
        <div className="container">
          <div className="chapter-heading">
            <span className="chapter-num">[05]</span>
            <div className="section-eyebrow" style={{ marginBottom: 0 }}>
              Integrations
            </div>
          </div>
          <h2 className="section-title">Where SwarmApi plugs in.</h2>
          <p className="section-lede">
            MCP registries, packages, live ops — same gateway everywhere.
          </p>
          <div className="integrations-strip">
            <h3>Hosts &amp; distribution</h3>
            <div className="integrations-row">
              <span style={{ fontSize: 13, color: "var(--muted)" }}>MCP:</span>
              <a href={NPM_URL} target="_blank" rel="noreferrer">
                Cursor
              </a>
              <a href={NPM_URL} target="_blank" rel="noreferrer">
                Claude Desktop
              </a>
              <a href={NPM_URL} target="_blank" rel="noreferrer">
                Continue
              </a>
              <a href={SMITHERY_SERVER_URL} target="_blank" rel="noreferrer">
                Smithery
              </a>
              <span style={{ fontSize: 13, color: "var(--muted)" }}>Packages:</span>
              <a href={NPM_URL} target="_blank" rel="noreferrer">
                @swarm-api/mcp
              </a>
              <a href={NPM_SDK_URL} target="_blank" rel="noreferrer">
                @swarm-api/sdk
              </a>
              <a href={NPM_SETUP_URL} target="_blank" rel="noreferrer">
                @swarm-api/setup
              </a>
              <span style={{ fontSize: 13, color: "var(--muted)" }}>Product:</span>
              <a href={MARKETPLACE_URL}>Marketplace</a>
              <a href={DASHBOARD_URL}>Dashboard</a>
              <a href="/status">Status</a>
              <a href={GITHUB_REPO_URL} target="_blank" rel="noreferrer">
                Source
              </a>
              <a href={X402_REPO_URL} target="_blank" rel="noreferrer">
                x402
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="block" id="install">
        <div className="container">
          <div className="quickstart">
            <h2>Install</h2>
            <p>
              Fast path: run the setup CLI, paste one JSON block into your MCP host, restart. Use the
              SDK when you are not inside an MCP runtime.
            </p>

            <div className="dist-grid" aria-label="Install and distribution links">
              <a className="dist-card" href={SMITHERY_SERVER_URL} target="_blank" rel="noreferrer">
                <span className="dist-label">Registry</span>
                <strong className="dist-title">Smithery</strong>
                <span className="dist-desc">Hosted MCP install for supported clients.</span>
              </a>
              <a className="dist-card" href={NPM_URL} target="_blank" rel="noreferrer">
                <span className="dist-label">Package</span>
                <strong className="dist-title">@swarm-api/mcp</strong>
                <span className="dist-desc">stdio MCP — Cursor, Claude Desktop, Continue.</span>
              </a>
              <a className="dist-card" href={NPM_SETUP_URL} target="_blank" rel="noreferrer">
                <span className="dist-label">CLI</span>
                <strong className="dist-title">@swarm-api/setup</strong>
                <span className="dist-desc">Wallet, funding prompts, paste-ready MCP config.</span>
              </a>
              <a className="dist-card" href={GITHUB_REPO_URL} target="_blank" rel="noreferrer">
                <span className="dist-label">Source</span>
                <strong className="dist-title">GitHub</strong>
                <span className="dist-desc">Monorepo and gateway reference.</span>
              </a>
            </div>

            <div className="install-step">
              <div className="step-num">1</div>
              <div className="step-body">
                <p className="step-title">
                  <strong>Cursor / Claude / Continue:</strong> run setup
                </p>
                <pre className="code config-block">{`$ npx -y @swarm-api/setup`}</pre>
                <p className="muted">
                  Generates or imports a Base wallet, waits for USDC on Base if you choose, writes{" "}
                  <code>~/.swarmapi/claude-desktop.json</code>. Merge the{" "}
                  <code>mcpServers.swarmapi</code> object into{" "}
                  <code>~/.cursor/mcp.json</code> or Claude&apos;s config — see the{" "}
                  <a href={NPM_URL} target="_blank" rel="noreferrer">
                    MCP readme
                  </a>
                  .
                </p>
              </div>
            </div>

            <div className="install-step">
              <div className="step-num">2</div>
              <div className="step-body">
                <p className="step-title">
                  <strong>Backend / script:</strong> SDK snippet
                </p>
                <pre className="code">{`import { createAgentClient } from "@swarm-api/sdk";

const fetch = createAgentClient({
  privateKey: process.env.AGENT_PRIVATE_KEY,
  maxSpendPerRequest: 100_000n, // $0.10 cap (atomic USDC)
});

const res = await fetch(
  "${GATEWAY_URL}/v1/companies/filings?id=0000320193"
);
const body = await res.json();`}</pre>
              </div>
            </div>

            <details className="landing-details">
              <summary>Full CLI transcript &amp; funding detail</summary>
              <div className="details-body">
                <div className="step-body" style={{ paddingTop: 4 }}>
                  <p className="step-title">Interactive setup output (abbreviated paths):</p>
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
                      <strong>Bring your own wallet, or generate a fresh one.</strong> The CLI accepts
                      a raw private key (<code>--key 0x...</code>), a 12 or 24-word BIP-39 mnemonic (
                      <code>--mnemonic &quot;...&quot;</code>), or generates one for you. Keys are
                      written to <code>~/.swarmapi/wallet.json</code> (chmod 600) before network calls —
                      Ctrl-C during polling is safe.
                    </p>
                    <p className="muted">
                      <strong>Three ways to fund — pick any one:</strong>
                    </p>
                    <ul className="fund-list">
                      <li>
                        <strong>Send on Base</strong> — the CLI prints your address and polls. Send USDC
                        on Base from MetaMask, Coinbase (Withdraw → Base), Binance, Phantom, treasury,
                        or hardware wallet.
                      </li>
                      <li>
                        <strong>Buy then withdraw</strong> — purchase USDC on an exchange and
                        withdraw/send on Base to the printed address. Hosted card checkout needs a CDP{" "}
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
                        <strong>Bridge or swap</strong> — bridge USDC or native assets to Base via
                        Across, the official Base bridge, or a DEX aggregator, then send to the printed
                        address.
                      </li>
                    </ul>
                    <p className="muted">
                      Power flags: <code>--reuse</code>, <code>--testnet</code>, <code>--json</code>,{" "}
                      <code>--no-poll</code>, <code>--no-open</code>, <code>--gateway</code>,{" "}
                      <code>--max-spend</code>. Run <code>npx -y @swarm-api/setup --help</code>.
                    </p>
                </div>

                <div className="install-step">
                  <div className="step-num">3</div>
                  <div className="step-body">
                    <p className="step-title">Merge MCP config &amp; restart the host app.</p>
                    <p className="muted">
                      <strong>Claude Desktop:</strong>{" "}
                      <code>~/Library/Application Support/Claude/claude_desktop_config.json</code>{" "}
                      (macOS) or <code>%APPDATA%\Claude\</code> (Windows). Paste{" "}
                      <code>swarmapi</code> into <code>mcpServers</code>.
                    </p>
                    <p className="muted">
                      <strong>Cursor:</strong> same block under <code>mcpServers</code> in{" "}
                      <code>~/.cursor/mcp.json</code>.
                    </p>
                  </div>
                </div>

                <div className="install-step">
                  <div className="step-num">4</div>
                  <div className="step-body">
                    <p className="step-title">Prompt with tools enabled.</p>
                    <p className="muted">
                      <em>
                        &quot;Pull the latest 8-K filings for AAPL and summarise material
                        events.&quot;
                      </em>
                    </p>
                    <p className="muted">
                      Default MCP spend guardrails typically cap a single request near{" "}
                      <strong>$0.10</strong> USDC unless you raise them — tune{" "}
                      <code>SWARMAPI_MAX_SPEND_PER_REQUEST_ATOMIC</code> / host docs for your risk.
                    </p>
                  </div>
                </div>
              </div>
            </details>

            <div className="cta-row install-ctas">
              <a href={MARKETPLACE_URL} className="btn btn-primary">
                Marketplace →
              </a>
              <a href={SMITHERY_SERVER_URL} target="_blank" rel="noreferrer" className="btn">
                Smithery
              </a>
              <a href={NPM_SETUP_URL} target="_blank" rel="noreferrer" className="btn">
                @swarm-api/setup
              </a>
              <a href={NPM_URL} target="_blank" rel="noreferrer" className="btn">
                @swarm-api/mcp
              </a>
              <a href={NPM_SDK_URL} target="_blank" rel="noreferrer" className="btn">
                @swarm-api/sdk
              </a>
              <a href={GITHUB_REPO_URL} target="_blank" rel="noreferrer" className="btn">
                GitHub
              </a>
              <a href={X402_REPO_URL} target="_blank" rel="noreferrer" className="btn">
                x402 spec
              </a>
            </div>
          </div>
        </div>
      </section>

      <SiteFooter />
    </>
  );
}
