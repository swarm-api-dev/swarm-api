import {
  LANDING_ORIGIN,
  MARKETPLACE_URL,
  WHITE_PAPER_URL,
  STATUS_URL,
  GITHUB_REPO_URL,
  SMITHERY_SERVER_URL,
  NPM_URL,
} from "../../lib/site";

export function DashboardHeader() {
  return (
    <header className="site">
      <div className="container">
        <a href={LANDING_ORIGIN} className="brand">
          <span className="brand-mark">A</span>
          SwarmApi
        </a>
        <nav className="site-nav" aria-label="Primary">
          <a href={`${LANDING_ORIGIN}/#how-payment-works`}>Payment</a>
          <a href={`${LANDING_ORIGIN}/#install`}>Install</a>
          <a href={MARKETPLACE_URL}>Marketplace</a>
          <span className="site-nav-current" aria-current="page">
            Dashboard
          </span>
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
        </nav>
      </div>
    </header>
  );
}
