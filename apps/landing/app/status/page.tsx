import type { Metadata } from "next";

export const revalidate = 60;
export const dynamic = "force-dynamic";

const GATEWAY_URL = process.env.GATEWAY_URL ?? "https://api.swarm-api.com";
const SITE_URL = process.env.SITE_URL ?? "https://swarm-api.com";

export const metadata: Metadata = {
  title: "Status — SwarmApi",
  description:
    "Live operational status of the SwarmApi x402 gateway. Endpoint catalog, recent settlement counts, and uptime.",
  alternates: { canonical: `${SITE_URL}/status` },
  robots: { index: true, follow: true },
  openGraph: {
    title: "SwarmApi · Status",
    description: "Live operational status of the SwarmApi x402 gateway.",
    url: `${SITE_URL}/status`,
    type: "website",
  },
};

interface Stats {
  settledCount: number;
  failedCount: number;
  revenueAtomic: string;
  uniquePayers: number;
  endpointCount: number;
}

interface CatalogEndpoint {
  id: string;
  name: string;
  description: string | null;
  method: string;
  resource: string;
  priceAtomic: string;
  asset: string;
  network: string;
  payTo: string;
  gatewayUrl: string;
}

interface CatalogResponse {
  count: number;
  endpoints: CatalogEndpoint[];
}

interface PaymentRow {
  id: string;
  method: string;
  resource: string;
  status: "settled" | "failed";
  payerAddress: string | null;
  amountAtomic: string | null;
  txHash: string | null;
  createdAt: string;
}

interface PaymentsResponse {
  count: number;
  payments: PaymentRow[];
}

type ProbeStatus = "ok" | "down";

async function safeFetch<T>(
  url: string,
  init?: RequestInit,
): Promise<{ status: ProbeStatus; latencyMs: number; data?: T; httpStatus?: number; error?: string }> {
  const started = Date.now();
  try {
    const res = await fetch(url, {
      ...init,
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    const latencyMs = Date.now() - started;
    if (!res.ok) {
      return { status: "down", latencyMs, httpStatus: res.status, error: `HTTP ${res.status}` };
    }
    const data = (await res.json()) as T;
    return { status: "ok", latencyMs, data, httpStatus: res.status };
  } catch (err) {
    return {
      status: "down",
      latencyMs: Date.now() - started,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Probe a paid endpoint by issuing an unauthenticated request. A healthy
 * x402 endpoint will respond with HTTP 402 and a payment-required challenge.
 * Anything else (5xx, timeout, 200 without payment) means trouble.
 */
async function probePaidEndpoint(
  method: string,
  resource: string,
): Promise<{ status: ProbeStatus; latencyMs: number; httpStatus?: number; note?: string }> {
  const started = Date.now();
  try {
    const res = await fetch(`${GATEWAY_URL}${resource}`, {
      method,
      headers: method === "POST" ? { "Content-Type": "application/json" } : undefined,
      body: method === "POST" ? "{}" : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(6000),
    });
    const latencyMs = Date.now() - started;
    if (res.status === 402) {
      return { status: "ok", latencyMs, httpStatus: 402, note: "402 challenge OK" };
    }
    if (res.status >= 500) {
      return { status: "down", latencyMs, httpStatus: res.status, note: `HTTP ${res.status}` };
    }
    // 4xx other than 402 = handler bug (route missing, validation failed before paymentMiddleware)
    return { status: "ok", latencyMs, httpStatus: res.status, note: `HTTP ${res.status}` };
  } catch (err) {
    return {
      status: "down",
      latencyMs: Date.now() - started,
      note: err instanceof Error ? err.message.slice(0, 80) : "timeout",
    };
  }
}

function formatUsd(atomic: string | null): string {
  if (!atomic) return "—";
  const n = Number(atomic);
  if (!Number.isFinite(n) || n <= 0) return "—";
  return `$${(n / 1_000_000).toFixed(n < 10_000 ? 4 : 2)}`;
}

function formatRelative(iso: string): string {
  const ageMs = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ageMs) || ageMs < 0) return iso;
  const s = Math.floor(ageMs / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function shortAddr(addr: string | null): string {
  if (!addr) return "—";
  if (addr.length < 14) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export default async function StatusPage() {
  const [health, stats, catalog, recent] = await Promise.all([
    safeFetch<{ ok: boolean }>(`${GATEWAY_URL}/health`),
    safeFetch<Stats>(`${GATEWAY_URL}/v1/stats`),
    safeFetch<CatalogResponse>(`${GATEWAY_URL}/v1/catalog`),
    safeFetch<PaymentsResponse>(`${GATEWAY_URL}/v1/payments?limit=10`),
  ]);

  // Probe every paid endpoint in parallel. This is server-rendered every 60s,
  // not on every request, so the load on the gateway is bounded.
  const endpoints = catalog.data?.endpoints ?? [];
  const probes = await Promise.all(
    endpoints.map((e) => probePaidEndpoint(e.method, e.resource)),
  );

  const allOk =
    health.status === "ok" &&
    stats.status === "ok" &&
    catalog.status === "ok" &&
    recent.status === "ok" &&
    probes.every((p) => p.status === "ok");

  const someOk =
    health.status === "ok" ||
    stats.status === "ok" ||
    catalog.status === "ok" ||
    probes.some((p) => p.status === "ok");

  const overall: "operational" | "degraded" | "down" = allOk
    ? "operational"
    : someOk
    ? "degraded"
    : "down";

  const overallLabel =
    overall === "operational"
      ? "All systems operational"
      : overall === "degraded"
      ? "Partial outage"
      : "Major outage";

  return (
    <main className="container" style={{ padding: "48px 24px" }}>
      <header style={{ marginBottom: 32 }}>
        <a href="/" className="muted" style={{ fontSize: 14 }}>
          ← swarm-api.com
        </a>
        <h1 style={{ fontSize: 32, margin: "12px 0 8px" }}>System status</h1>
        <p className="muted" style={{ margin: 0 }}>
          Live operational status of the SwarmApi x402 gateway. Auto-refreshes every 60 seconds.
        </p>
      </header>

      <section className={`status-banner status-${overall}`}>
        <span className={`status-dot status-${overall}`} aria-hidden />
        <span style={{ fontWeight: 600, fontSize: 18 }}>{overallLabel}</span>
        <span className="muted" style={{ marginLeft: "auto", fontSize: 13 }}>
          {new Date().toISOString().slice(0, 19).replace("T", " ")} UTC
        </span>
      </section>

      <section className="status-grid">
        <StatusCard
          title="Gateway"
          status={health.status}
          latencyMs={health.latencyMs}
          subtitle={GATEWAY_URL.replace(/^https?:\/\//, "")}
          detail={health.error}
        />
        <StatusCard
          title="Stats API"
          status={stats.status}
          latencyMs={stats.latencyMs}
          subtitle="/v1/stats"
          detail={stats.error}
        />
        <StatusCard
          title="Catalog API"
          status={catalog.status}
          latencyMs={catalog.latencyMs}
          subtitle="/v1/catalog"
          detail={catalog.error}
        />
        <StatusCard
          title="Payment log"
          status={recent.status}
          latencyMs={recent.latencyMs}
          subtitle="/v1/payments"
          detail={recent.error}
        />
      </section>

      {stats.data ? (
        <section className="metric-grid">
          <Metric label="Settled (all-time)" value={stats.data.settledCount.toLocaleString()} />
          <Metric label="Failed (all-time)" value={stats.data.failedCount.toLocaleString()} />
          <Metric label="Revenue (USDC)" value={formatUsd(stats.data.revenueAtomic)} />
          <Metric label="Unique payers" value={stats.data.uniquePayers.toLocaleString()} />
        </section>
      ) : null}

      <section style={{ marginTop: 40 }}>
        <h2 style={{ fontSize: 20, marginBottom: 12 }}>Paid endpoints</h2>
        <p className="muted" style={{ marginTop: 0, marginBottom: 16 }}>
          Each endpoint is probed without payment — a healthy x402 route replies with HTTP 402 and
          a signed challenge. Any 5xx or timeout means the endpoint is degraded.
        </p>
        <div className="endpoint-list">
          {endpoints.length === 0 ? (
            <div className="endpoint-row endpoint-down">
              <span>Catalog unavailable</span>
            </div>
          ) : (
            endpoints.map((e, idx) => {
              const probe = probes[idx]!;
              return (
                <div
                  key={e.id}
                  className={`endpoint-row ${probe.status === "ok" ? "endpoint-ok" : "endpoint-down"}`}
                >
                  <span className={`status-dot status-${probe.status === "ok" ? "operational" : "down"}`} aria-hidden />
                  <span className="endpoint-method">{e.method}</span>
                  <code className="endpoint-resource">{e.resource}</code>
                  <span className="endpoint-price">{formatUsd(e.priceAtomic)}</span>
                  <span className="muted endpoint-meta">
                    {probe.note ?? "—"} · {probe.latencyMs}ms
                  </span>
                </div>
              );
            })
          )}
        </div>
      </section>

      <section style={{ marginTop: 40 }}>
        <h2 style={{ fontSize: 20, marginBottom: 12 }}>Recent settlements</h2>
        <p className="muted" style={{ marginTop: 0, marginBottom: 16 }}>
          Last 10 payment events from <code>/v1/payments</code>. Failed events include 402 challenges
          that were never paid (normal) plus settlement errors (rare).
        </p>
        <div className="table-wrap">
          <table className="status-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Method</th>
                <th>Resource</th>
                <th>Status</th>
                <th>Amount</th>
                <th>Payer</th>
              </tr>
            </thead>
            <tbody>
              {recent.data?.payments?.length ? (
                recent.data.payments.map((p) => (
                  <tr key={p.id}>
                    <td className="muted">{formatRelative(p.createdAt)}</td>
                    <td>
                      <code>{p.method}</code>
                    </td>
                    <td>
                      <code>{p.resource}</code>
                    </td>
                    <td>
                      <span
                        className={p.status === "settled" ? "badge-ok" : "badge-fail"}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td>{formatUsd(p.amountAtomic)}</td>
                    <td className="muted">{shortAddr(p.payerAddress)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="muted">
                    No payment events yet — be the first.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <footer style={{ marginTop: 56, paddingTop: 24, borderTop: "1px solid var(--border)" }}>
        <p className="muted" style={{ fontSize: 13, margin: 0 }}>
          Gateway: <a href={GATEWAY_URL}>{GATEWAY_URL}</a> · Settles on Base mainnet · USDC{" "}
          <a href="https://basescan.org/token/0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913">
            0x8335…2913
          </a>{" "}
          · <a href="https://github.com/swarm-api-dev/swarm-api">Source</a>
        </p>
      </footer>
    </main>
  );
}

function StatusCard({
  title,
  status,
  latencyMs,
  subtitle,
  detail,
}: {
  title: string;
  status: ProbeStatus;
  latencyMs: number;
  subtitle: string;
  detail?: string;
}) {
  return (
    <div className={`status-card status-${status === "ok" ? "operational" : "down"}`}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span className={`status-dot status-${status === "ok" ? "operational" : "down"}`} aria-hidden />
        <span style={{ fontWeight: 600 }}>{title}</span>
      </div>
      <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
        {subtitle}
      </div>
      <div style={{ fontSize: 13, marginTop: 8 }}>
        {status === "ok" ? `${latencyMs}ms` : detail ?? "Offline"}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric-card">
      <div className="muted" style={{ fontSize: 12 }}>
        {label}
      </div>
      <div style={{ fontSize: 24, fontWeight: 600, marginTop: 4 }}>{value}</div>
    </div>
  );
}
