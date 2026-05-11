const DEFAULT_GATEWAY = "https://api.swarm-api.com";

/** Production dashboard/marketing hosts must never be used as the gateway base URL. */
function resolveGatewayBase(): string {
  const raw = process.env.GATEWAY_URL?.trim();
  if (!raw) return DEFAULT_GATEWAY;
  try {
    const u = new URL(raw);
    const bad = new Set([
      "swarm-api.com",
      "www.swarm-api.com",
      "marketplace.swarm-api.com",
      "dashboard.swarm-api.com",
    ]);
    if (bad.has(u.hostname)) return DEFAULT_GATEWAY;
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

export interface Payment {
  id: string;
  method: string;
  resource: string;
  status: "settled" | "failed";
  payerAddress: string | null;
  payTo: string | null;
  asset: string | null;
  network: string | null;
  amountAtomic: string | null;
  txHash: string | null;
  errorCode: string | null;
  createdAt: string;
}

function isPaymentRow(x: unknown): x is Payment {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    typeof o.method === "string" &&
    typeof o.resource === "string" &&
    (o.status === "settled" || o.status === "failed") &&
    typeof o.createdAt === "string"
  );
}

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
      typeof data.failedCount !== "number" ||
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

export async function fetchPayments(limit = 50): Promise<Payment[]> {
  try {
    const res = await fetch(`${GATEWAY_BASE_URL}/v1/payments?limit=${limit}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return [];
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("application/json")) return [];
    const data = (await res.json()) as { payments?: unknown[] };
    const rows = Array.isArray(data.payments) ? data.payments : [];
    return rows.filter(isPaymentRow);
  } catch {
    return [];
  }
}
