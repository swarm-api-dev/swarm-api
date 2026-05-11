/** Shared URLs for landing + subpages. */

export const SITE_URL = "https://swarm-api.com";
export const GATEWAY_URL = "https://api.swarm-api.com";

/** Use HTTPS satellites on Vercel; localhost only when not deployed there (local dev / CI). */
function satelliteUrl(envKey: string, nextPublicKey: string, vercelDefault: string, localDefault: string): string {
  const direct = process.env[envKey]?.trim();
  if (direct) return direct;
  const nextPublic = process.env[nextPublicKey]?.trim();
  if (nextPublic) return nextPublic;
  const onVercel = process.env.VERCEL === "1";
  const vercelEnv = process.env.VERCEL_ENV;
  if (onVercel && (vercelEnv === "production" || vercelEnv === "preview")) {
    return vercelDefault;
  }
  return localDefault;
}

export const DASHBOARD_URL = satelliteUrl(
  "DASHBOARD_URL",
  "NEXT_PUBLIC_DASHBOARD_URL",
  "https://dashboard.swarm-api.com",
  "http://localhost:3001",
);

export const MARKETPLACE_URL = satelliteUrl(
  "MARKETPLACE_URL",
  "NEXT_PUBLIC_MARKETPLACE_URL",
  "https://marketplace.swarm-api.com",
  "http://localhost:3002",
);

/** SwarmApi product whitepaper (this site). */
export const SWARMAPI_WHITEPAPER_HREF = "/whitepaper";

/** Canonical x402 protocol document (Coinbase / x402.org). */
export const X402_WHITEPAPER_PDF = "https://www.x402.org/x402-whitepaper.pdf";

export const X402_REPO_URL = "https://github.com/x402-foundation/x402";
export const NPM_URL = "https://www.npmjs.com/package/@swarm-api/mcp";
export const NPM_SETUP_URL = "https://www.npmjs.com/package/@swarm-api/setup";
export const NPM_SDK_URL = "https://www.npmjs.com/package/@swarm-api/sdk";
export const SMITHERY_SERVER_URL = "https://smithery.ai/servers/swarm-api/swarmapi";
export const GITHUB_REPO_URL = "https://github.com/swarm-api-dev/swarm-api";
