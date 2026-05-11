import Link from "next/link";
import {
  DASHBOARD_URL,
  MARKETPLACE_URL,
  SWARMAPI_WHITEPAPER_HREF,
  X402_WHITEPAPER_PDF,
  X402_REPO_URL,
  GITHUB_REPO_URL,
  SMITHERY_SERVER_URL,
  NPM_URL,
} from "../../lib/site";

export function SiteFooter() {
  return (
    <footer className="site">
      <div className="container">
        <div>
          Built on{" "}
          <a href={X402_WHITEPAPER_PDF} target="_blank" rel="noreferrer">
            x402
          </a>{" "}
          · USDC on Base · MIT license
        </div>
        <div className="links">
          <a href={MARKETPLACE_URL}>Marketplace</a>
          <a href={DASHBOARD_URL}>Dashboard</a>
          <Link href="/status">Status</Link>
          <a href={GITHUB_REPO_URL} target="_blank" rel="noreferrer">
            GitHub
          </a>
          <a href={SMITHERY_SERVER_URL} target="_blank" rel="noreferrer">
            Smithery
          </a>
          <a href={NPM_URL} target="_blank" rel="noreferrer">
            npm
          </a>
          <Link href={SWARMAPI_WHITEPAPER_HREF}>Whitepaper</Link>
          <a href={X402_REPO_URL} target="_blank" rel="noreferrer">
            x402 spec
          </a>
        </div>
      </div>
    </footer>
  );
}
