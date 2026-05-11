/** Marketing site origin (landing + whitepaper + status live here). */
export const SITE_URL_MARKETING = "https://swarm-api.com";

export function landingOrigin(): string {
  const o = process.env.NEXT_PUBLIC_LANDING_ORIGIN?.trim();
  if (o) return o.replace(/\/$/, "");
  if (process.env.VERCEL === "1") return SITE_URL_MARKETING;
  return "http://localhost:3003";
}

export const LANDING_ORIGIN = landingOrigin();

/** Marketing hostname only — never use as Marketplace/Dashboard target (misconfigured env). */
function stripMarketingHost(url: string, prodDefault: string): string {
  try {
    const u = new URL(url);
    if (u.hostname === "swarm-api.com" || u.hostname === "www.swarm-api.com") {
      return prodDefault;
    }
  } catch {
    return prodDefault;
  }
  return url;
}

function satelliteUrl(envKey: string, nextPublicKey: string, vercelDefault: string, localDefault: string): string {
  const directRaw = process.env[envKey]?.trim();
  if (directRaw) return stripMarketingHost(directRaw, vercelDefault);
  const nextPublic = process.env[nextPublicKey]?.trim();
  if (nextPublic) return stripMarketingHost(nextPublic, vercelDefault);
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

export const WHITE_PAPER_URL = `${LANDING_ORIGIN}/whitepaper`;
export const STATUS_URL = `${LANDING_ORIGIN}/status`;

export const X402_WHITEPAPER_PDF = "https://www.x402.org/x402-whitepaper.pdf";
export const X402_REPO_URL = "https://github.com/x402-foundation/x402";
export const NPM_URL = "https://www.npmjs.com/package/@swarm-api/mcp";
export const NPM_SETUP_URL = "https://www.npmjs.com/package/@swarm-api/setup";
export const NPM_SDK_URL = "https://www.npmjs.com/package/@swarm-api/sdk";
export const SMITHERY_SERVER_URL = "https://smithery.ai/servers/swarm-api/swarmapi";
export const GITHUB_REPO_URL = "https://github.com/swarm-api-dev/swarm-api";
