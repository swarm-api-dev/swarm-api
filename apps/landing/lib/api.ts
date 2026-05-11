const GATEWAY_URL = process.env.GATEWAY_URL ?? "https://api.swarm-api.com";

export interface Stats {
  settledCount: number;
  failedCount: number;
  revenueAtomic: string;
  uniquePayers: number;
  endpointCount: number;
}

export async function fetchStats(): Promise<Stats> {
  const res = await fetch(`${GATEWAY_URL}/v1/stats`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Gateway /v1/stats failed: ${res.status}`);
  }
  return (await res.json()) as Stats;
}
