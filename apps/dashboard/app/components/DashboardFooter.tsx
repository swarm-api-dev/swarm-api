import {
  LANDING_ORIGIN,
  DASHBOARD_URL,
  MARKETPLACE_URL,
  WHITE_PAPER_URL,
  STATUS_URL,
  X402_WHITEPAPER_PDF,
  X402_REPO_URL,
  GITHUB_REPO_URL,
  SMITHERY_SERVER_URL,
  NPM_URL,
} from "../../lib/site";

export function DashboardFooter() {
  return (
    <footer className="site">
      <div className="container">
        <div>
          <a href={LANDING_ORIGIN}>SwarmApi</a>
          {" · "}
          Built on{" "}
          <a href={X402_WHITEPAPER_PDF} target="_blank" rel="noreferrer">
            x402
          </a>{" "}
          · USDC on Base · MIT license
        </div>
        <div className="links">
          <a href={MARKETPLACE_URL}>Marketplace</a>
          <a href={DASHBOARD_URL}>Dashboard</a>
          <a href={STATUS_URL}>Status</a>
          <a href={GITHUB_REPO_URL} target="_blank" rel="noreferrer">
            GitHub
          </a>
          <a href={SMITHERY_SERVER_URL} target="_blank" rel="noreferrer">
            Smithery
          </a>
          <a href={NPM_URL} target="_blank" rel="noreferrer">
            npm
          </a>
          <a href={WHITE_PAPER_URL}>Whitepaper</a>
          <a href={X402_REPO_URL} target="_blank" rel="noreferrer">
            x402 spec
          </a>
        </div>
      </div>
    </footer>
  );
}
