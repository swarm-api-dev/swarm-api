const GATEWAY_URL = process.env.GATEWAY_URL ?? "http://localhost:3000";

export interface Stats {
  settledCount: number;
  failedCount: number;
  revenueAtomic: string;
  uniquePayers: number;
  endpointCount: number;
}

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

export async function fetchStats(): Promise<Stats> {
  const res = await fetch(`${GATEWAY_URL}/v1/stats`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Gateway /v1/stats failed: ${res.status}`);
  return (await res.json()) as Stats;
}

export async function fetchPayments(limit = 50): Promise<Payment[]> {
  const res = await fetch(`${GATEWAY_URL}/v1/payments?limit=${limit}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Gateway /v1/payments failed: ${res.status}`);
  const data = (await res.json()) as { payments: Payment[] };
  return data.payments;
}
