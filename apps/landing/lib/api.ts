const DEFAULT_GATEWAY = "https://api.swarm-api.com";

/** Never treat the marketing host as the API gateway (avoids SSR self-fetch → 403 loops). */
function resolveGatewayBase(): string {
  const raw = process.env.GATEWAY_URL?.trim();
  if (!raw) return DEFAULT_GATEWAY;
  try {
    const u = new URL(raw);
    const marketing = new Set(["swarm-api.com", "www.swarm-api.com"]);
    if (marketing.has(u.hostname)) return DEFAULT_GATEWAY;
    return raw.replace(/\/+$/, "");
  } catch {
    return DEFAULT_GATEWAY;
  }
}

export const GATEWAY_BASE_URL = resolveGatewayBase();

export interface Stats {
  settledCount: number;
  failedCount: number;
  revenueAtomic: string;
  uniquePayers: number;
  endpointCount: number;
}

const STATS_FALLBACK: Stats = {
  settledCount: 0,
  failedCount: 0,
  revenueAtomic: "0",
  uniquePayers: 0,
  endpointCount: 0,
};

export async function fetchStats(): Promise<Stats> {
  try {
    const res = await fetch(`${GATEWAY_BASE_URL}/v1/stats`, {
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return STATS_FALLBACK;
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("application/json")) return STATS_FALLBACK;
    const data = (await res.json()) as Stats;
    if (
      typeof data.settledCount !== "number" ||
      typeof data.uniquePayers !== "number" ||
      typeof data.endpointCount !== "number" ||
      typeof data.revenueAtomic !== "string"
    ) {
      return STATS_FALLBACK;
    }
    return data;
  } catch {
    return STATS_FALLBACK;
  }
}
