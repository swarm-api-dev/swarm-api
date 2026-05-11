import Link from "next/link";
import {
  DASHBOARD_URL,
  MARKETPLACE_URL,
  SWARMAPI_WHITEPAPER_HREF,
  GITHUB_REPO_URL,
  SMITHERY_SERVER_URL,
  NPM_URL,
} from "../../lib/site";

export type SiteHeaderActive = "home" | "whitepaper";

export function SiteHeader({ active }: { active?: SiteHeaderActive }) {
  const paymentHref = active === "home" ? "#how-payment-works" : "/#how-payment-works";
  const installHref = active === "home" ? "#install" : "/#install";

  return (
    <header className="site">
      <div className="container">
        <Link href="/" className="brand">
          <span className="brand-mark">A</span>
          SwarmApi
        </Link>
        <nav className="site-nav" aria-label="Primary">
          <a href={paymentHref}>Payment</a>
          <a href={installHref}>Install</a>
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
          {active === "whitepaper" ? (
            <span className="site-nav-current" aria-current="page">
              Whitepaper
            </span>
          ) : (
            <Link href={SWARMAPI_WHITEPAPER_HREF}>Whitepaper</Link>
          )}
        </nav>
      </div>
    </header>
  );
}
