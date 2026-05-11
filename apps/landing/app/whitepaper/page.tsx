import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "../components/SiteFooter";
import { SiteHeader } from "../components/SiteHeader";
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
} from "../../lib/site";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Whitepaper — SwarmApi",
  description:
    "SwarmApi: a production x402 gateway for structured agent APIs (SEC, signals, search, code intelligence). Architecture, payment flow, surfaces, and alignment with the HTTP 402 USDC standard.",
  alternates: { canonical: `${SITE_URL}/whitepaper` },
  robots: { index: true, follow: true },
  openGraph: {
    title: "SwarmApi Whitepaper",
    description:
      "How SwarmApi implements agent-native APIs on x402: MCP, SDK, micropayments on Base, and a catalog of priced JSON tools.",
    url: `${SITE_URL}/whitepaper`,
    type: "article",
    siteName: "SwarmApi",
  },
};

export default function WhitepaperPage() {
  return (
    <>
      <SiteHeader active="whitepaper" />

      <article className="container wp-doc">
        <p className="wp-kicker">SwarmApi · Technical overview</p>
        <h1 className="wp-title">SwarmApi and x402: Agent-native APIs with HTTP settlement</h1>
        <p className="wp-meta">
          Version 1.0 · May 2026 · Source:{" "}
          <a href={GITHUB_REPO_URL} target="_blank" rel="noreferrer">
            swarm-api-dev/swarm-api
          </a>
        </p>

        <nav className="wp-jump" aria-label="Sections in this document">
          <a href="#abstract">Abstract</a>
          <a href="#motivation">Motivation</a>
          <a href="#x402">x402</a>
          <a href="#what-is-swarmapi">Product</a>
          <a href="#architecture">Architecture</a>
          <a href="#flow">Payment</a>
          <a href="#catalog">Catalog</a>
          <a href="#comparison">Comparison</a>
          <a href="#security">Security</a>
          <a href="#limitations">Scope</a>
          <a href="#references">References</a>
        </nav>

        <section className="wp-section" id="abstract">
          <h2>Abstract</h2>
          <p>
            SwarmApi is a live HTTP gateway that exposes <strong>structured JSON APIs</strong> for AI
            agents—covering public-company disclosure (SEC EDGAR), news and hiring signals, open-web
            search, GitHub repository health, and software supply-chain metadata including CVE context.
            Access is monetized <strong>per successful HTTP response</strong> using{" "}
            <strong>x402</strong>: the open standard that repurposes{" "}
            <strong>HTTP 402 Payment Required</strong> together with stablecoin authorization (USDC on
            Base) so clients pay without vendor API keys or subscription contracts.
          </p>
          <p>
            This document describes SwarmApi in the same conceptual frame as the{" "}
            <a href={X402_WHITEPAPER_PDF} target="_blank" rel="noreferrer">
              x402 whitepaper
            </a>
            : motivation, payment rail, core flow, agentic commerce, and pragmatic micropayments. It is{" "}
            <em>not</em> a substitute for the canonical x402 specification; where protocol bytes matter,
            implementers should follow the official paper and reference implementation.
          </p>
        </section>

        <section className="wp-section" id="motivation">
          <h2>1. Motivation</h2>
          <p>
            Autonomous and semi-autonomous agents need three things from third-party data:{" "}
            <strong>freshness</strong>, <strong>machine-readable shape</strong>, and{" "}
            <strong>permission to spend</strong> small amounts without humans inventing accounts for every
            vendor. Legacy API economics bias toward annual contracts, human onboarding, and static keys—poor
            fits for per-task agent runs.
          </p>
          <p>
            On-chain settlement on fast L2s removes chargeback-shaped uncertainty for digital goods,
            enables <strong>sub-cent effective pricing</strong> at the protocol layer for micropayments,
            and lets an agent hold one funded wallet rather than a spreadsheet of API secrets. The x402
            whitepaper argues this foundation clearly; SwarmApi applies it to a concrete catalog of research
            and engineering tools.
          </p>
          <ul className="wp-list">
            <li>
              <strong>Problem:</strong> Agents stall on stale training data, unstructured HTML, or blocked
              vendor signup flows.
            </li>
            <li>
              <strong>Approach:</strong> Normalize heterogeneous sources into JSON suited for tool-calling,
              then charge only when the gateway returns that payload.
            </li>
            <li>
              <strong>Outcome:</strong> Predictable unit economics per agent task (e.g., a full
              company-intelligence pass priced as the sum of discrete tool calls).
            </li>
          </ul>
        </section>

        <section className="wp-section" id="x402">
          <h2>2. The x402 protocol (recap)</h2>
          <p>
            x402 defines an HTTP-native payment challenge: a resource server may answer an unauthenticated
            request with <strong>402 Payment Required</strong> and a machine-readable payment requirement.
            The client constructs an authorization for the quoted amount—typically{" "}
            <strong>EIP-3009 transferWithAuthorization</strong> USDC—attaches it on{" "}
            <strong>retry</strong>, and receives the resource when verification (and delegated settlement
            via a facilitator) succeeds.
          </p>
          <p>At a high level the core payment flow matches the x402 whitepaper:</p>
          <ol className="wp-ol">
            <li>
              <strong>Client request</strong> — Agent or backend calls the API route.
            </li>
            <li>
              <strong>402 challenge</strong> — Gateway returns terms (amount, asset, network, payee,
              timeout).
            </li>
            <li>
              <strong>Signed retry</strong> — Client sends the signed authorization header expected by the
              gateway.
            </li>
            <li>
              <strong>Verify, settle, respond</strong> — Gateway validates, fulfills the request JSON, and
              settlement completes on-chain through the configured facilitator.
            </li>
          </ol>
          <p>
            For normative detail, headers, and middleware patterns, see the{" "}
            <a href={X402_WHITEPAPER_PDF} target="_blank" rel="noreferrer">
              x402 whitepaper (PDF)
            </a>{" "}
            and the{" "}
            <a href={X402_REPO_URL} target="_blank" rel="noreferrer">
              x402 reference repository
            </a>
            .
          </p>
        </section>

        <section className="wp-section" id="what-is-swarmapi">
          <h2>3. What SwarmApi is</h2>
          <p>
            SwarmApi is the <strong>gateway</strong> at <code>{GATEWAY_URL}</code>, a public catalog of{" "}
            <strong>priced HTTP resources</strong>, and client libraries that hide the 402 retry loop:
          </p>
          <ul className="wp-list">
            <li>
              <strong>@swarm-api/mcp</strong> — Model Context Protocol server mapping catalog routes to
              tools for Cursor, Claude Desktop, Continue, and other MCP hosts (
              <a href={NPM_URL} target="_blank" rel="noreferrer">
                npm
              </a>
              ).
            </li>
            <li>
              <strong>@swarm-api/sdk</strong> — TypeScript client for services and scripts (
              <a href={NPM_SDK_URL} target="_blank" rel="noreferrer">
                npm
              </a>
              ).
            </li>
            <li>
              <strong>@swarm-api/setup</strong> — CLI for wallet material and paste-ready MCP configuration
              (
              <a href={NPM_SETUP_URL} target="_blank" rel="noreferrer">
                npm
              </a>
              ).
            </li>
          </ul>
          <p>
            Two MCP tools—<code>gateway_ping</code> and <code>gateway_catalog</code>—call public routes and{" "}
            <strong>never charge USDC</strong>, useful for wiring MCP before funding a wallet.
          </p>
        </section>

        <section className="wp-section" id="architecture">
          <h2>4. Architecture</h2>
          <pre className="wp-diagram">{`┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  MCP host       │     │  HTTP + SDK       │     │  Marketplace /   │
│  (Cursor, …)    │     │  backends         │     │  Dashboard       │
└────────┬────────┘     └────────┬─────────┘     └────────┬────────┘
         │ stdio / tools          │ HTTPS                   │ ops / schemas
         └────────────┬────────────┘                         │
                      ▼                                       │
             ┌────────────────────────────────────────────────┘
             │
             ▼
    ┌────────────────────────────┐
    │  SwarmApi Gateway           │
    │  x402 middleware · catalog  │
    └─────────────┬──────────────┘
                  │ EIP-3009 USDC · facilitator
                  ▼
           Base mainnet settlement`}</pre>
          <p>
            The <strong>Marketplace</strong> ({MARKETPLACE_URL}) surfaces schemas and integration snippets;
            the <strong>Dashboard</strong> ({DASHBOARD_URL}) reflects aggregate settlement activity. Neither
            replaces the gateway contract: paid tools ultimately authenticate payment at{" "}
            <code>{GATEWAY_URL}</code>.
          </p>
        </section>

        <section className="wp-section" id="flow">
          <h2>5. End-to-end payment flow (SwarmApi)</h2>
          <p>
            From an integrator&apos;s perspective SwarmApi behaves like any x402-protected API: first call
            may receive 402; funded clients complete signing (via SDK or MCP runtime) and retry
            automatically.
          </p>
          <p>
            MCP deployments should configure <strong>per-request spend caps</strong> so agents refuse quotes
            above operator policy—analogous to human approval limits, expressed in atomic USDC on the client.
          </p>
        </section>

        <section className="wp-section" id="catalog">
          <h2>6. Catalog philosophy</h2>
          <p>
            Endpoints are deliberately <strong>granular</strong>: resolve identity, list filings, extract
            structured Items, pull insider transactions, attach fresh news and jobs, search the web, inspect
            GitHub repos, and audit packages—each priced independently so agents only pay for tools they
            invoke.
          </p>
          <p>
            Sources include SEC EDGAR, GDELT-style news pipelines, public ATS job boards (Greenhouse /
            Lever where exposed), Brave Search, GitHub, language registries, and OSV.dev for vulnerability
            correlation. Coverage and latency vary by upstream; SwarmApi&apos;s contract is the JSON schema
            and HTTP semantics documented in the live catalog.
          </p>
        </section>

        <section className="wp-section" id="comparison">
          <h2>7. Traditional APIs vs. SwarmApi + x402</h2>
          <div className="wp-table-wrap">
            <table className="wp-table">
              <thead>
                <tr>
                  <th>Dimension</th>
                  <th>Typical vendor API</th>
                  <th>SwarmApi</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Credential</td>
                  <td>API key / OAuth tenant</td>
                  <td>USDC wallet + signed micropayment per request</td>
                </tr>
                <tr>
                  <td>Billing</td>
                  <td>Subscription or prepaid credits</td>
                  <td>Pay-per-use per successful response</td>
                </tr>
                <tr>
                  <td>Agent fit</td>
                  <td>Humans rotate keys; quota alerts</td>
                  <td>Programmatic 402 → sign → retry loop</td>
                </tr>
                <tr>
                  <td>Settlement</td>
                  <td>Card rails / invoicing</td>
                  <td>Stablecoin on Base (non-reversible like x402 narrative)</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="wp-section" id="security">
          <h2>8. Security and operations</h2>
          <ul className="wp-list">
            <li>
              <strong>Wallet hygiene:</strong> MCP and SDK integrations hold signing keys locally; operators
              must protect filesystem permissions and CI secrets like any hot wallet.
            </li>
            <li>
              <strong>Spend limits:</strong> Use SDK and host-level caps so compromised prompts cannot
              authorize unbounded USDC.
            </li>
            <li>
              <strong>Transparency:</strong> Open-source gateway and clients (
              <a href={GITHUB_REPO_URL} target="_blank" rel="noreferrer">
                MIT
              </a>
              ); verify behavior against public routes and the published catalog.
            </li>
          </ul>
        </section>

        <section className="wp-section" id="limitations">
          <h2>9. Scope and honesty</h2>
          <p>
            SwarmApi does not guarantee completeness of third-party sources (e.g., every private job board
            or every CVE disclosure path). It is not a securities product or investment advice interface.
            Pricing is per HTTP tool success as implemented by the gateway; downstream agents remain
            responsible for correctness, compliance, and disclosure obligations in their jurisdictions.
          </p>
        </section>

        <section className="wp-section" id="references">
          <h2>10. References</h2>
          <ol className="wp-ol">
            <li>
              Coinbase Developer Platform / x402 Foundation,{" "}
              <cite>
                <a href={X402_WHITEPAPER_PDF} target="_blank" rel="noreferrer">
                  x402: An open standard for internet-native payments
                </a>
              </cite>{" "}
              (PDF).
            </li>
            <li>
              x402 reference implementation:{" "}
              <a href={X402_REPO_URL} target="_blank" rel="noreferrer">
                github.com/x402-foundation/x402
              </a>
              .
            </li>
            <li>
              SwarmApi source &amp; issues:{" "}
              <a href={GITHUB_REPO_URL} target="_blank" rel="noreferrer">
                github.com/swarm-api-dev/swarm-api
              </a>
              .
            </li>
            <li>
              MCP registry listing:{" "}
              <a href={SMITHERY_SERVER_URL} target="_blank" rel="noreferrer">
                Smithery · swarm-api
              </a>
              .
            </li>
          </ol>
        </section>

        <p className="wp-back">
          <Link href="/">← Back to home</Link>
          {" · "}
          <a href="#abstract">Top</a>
        </p>
      </article>

      <SiteFooter />
    </>
  );
}
