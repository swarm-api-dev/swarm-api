import {
  fetchPayments,
  fetchStats,
  GATEWAY_BASE_URL,
  type Payment,
} from "../lib/api";
import { LANDING_ORIGIN, MARKETPLACE_URL, NPM_SDK_URL, STATUS_URL } from "../lib/site";

export const dynamic = "force-dynamic";

const USDC_DECIMALS = 6n;

function formatUsdc(atomic: string | null): string {
  if (!atomic) return "—";
  try {
    const value = BigInt(atomic);
    const whole = value / 10n ** USDC_DECIMALS;
    const frac = value % 10n ** USDC_DECIMALS;
    const fracStr = frac.toString().padStart(6, "0").replace(/0+$/, "");
    return fracStr.length === 0 ? `$${whole}` : `$${whole}.${fracStr}`;
  } catch {
    return atomic;
  }
}

function shortAddr(addr: string | null): string {
  if (!addr) return "—";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function formatTime(ts: string | Date | null): string {
  if (!ts) return "—";
  const iso = typeof ts === "string" ? ts : ts.toISOString();
  return iso.replace("T", " ").slice(0, 19);
}

function txExplorerUrl(txHash: string | null): string | null {
  if (!txHash || !txHash.startsWith("0x") || txHash.length !== 66) return null;
  return `https://basescan.org/tx/${txHash}`;
}

function TxCell({ p }: { p: Payment }) {
  const href = p.txHash ? txExplorerUrl(p.txHash) : null;
  if (href) {
    return (
      <a className="tx-link mono" href={href} target="_blank" rel="noreferrer">
        {shortAddr(p.txHash)}
      </a>
    );
  }
  return <span className="mono">{p.errorCode ?? "—"}</span>;
}

export default async function DashboardPage() {
  const [stats, recent] = await Promise.all([fetchStats(), fetchPayments(60)]);
  const total = stats.settledCount + stats.failedCount;
  const successPct = total === 0 ? 0 : Math.round((stats.settledCount / total) * 100);
  const successLabel = total === 0 ? "—" : `${successPct}%`;

  return (
    <main className="dash">
      <div className="page-head">
        <div>
          <p className="kicker">Operator console</p>
          <h1>Dashboard</h1>
          <p className="subtitle">
            Live settlement telemetry from the SwarmApi gateway: USDC micropayments on Base,
            success ratio, and every billed call your agents make via x402.
          </p>
        </div>
        <div className="page-head-actions">
          <a className="pill" href={`${GATEWAY_BASE_URL}/health`} target="_blank" rel="noreferrer">
            Gateway health
          </a>
          <a className="pill pill-muted" href={MARKETPLACE_URL}>
            API catalog
          </a>
          <a className="pill pill-muted" href={STATUS_URL}>
            Service status
          </a>
        </div>
      </div>

      <section className="panel" aria-labelledby="overview-heading">
        <h2 id="overview-heading" className="section-label">
          Overview
        </h2>
        <div className="metric-grid">
          <article className="metric-card">
            <div className="metric-card-head">
              <span className="metric-label">Revenue</span>
              <span className="metric-icon green" aria-hidden>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
              </span>
            </div>
            <div className="metric-value">{formatUsdc(stats.revenueAtomic)}</div>
            <p className="metric-hint">Total settled USDC (all time)</p>
          </article>

          <article className="metric-card">
            <div className="metric-card-head">
              <span className="metric-label">Settled calls</span>
              <span className="metric-icon blue" aria-hidden>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              </span>
            </div>
            <div className="metric-value">{stats.settledCount.toLocaleString()}</div>
            <p className="metric-hint">Successful x402 completions</p>
          </article>

          <article className="metric-card">
            <div className="metric-card-head">
              <span className="metric-label">Failed</span>
              <span className="metric-icon red" aria-hidden>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </span>
            </div>
            <div className="metric-value">{stats.failedCount.toLocaleString()}</div>
            <p className="metric-hint">Rejected or errored attempts</p>
          </article>

          <article className="metric-card">
            <div className="metric-card-head">
              <span className="metric-label">Unique payers</span>
              <span className="metric-icon purple" aria-hidden>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </span>
            </div>
            <div className="metric-value">{stats.uniquePayers.toLocaleString()}</div>
            <p className="metric-hint">Distinct wallets seen</p>
          </article>

          <article className="metric-card">
            <div className="metric-card-head">
              <span className="metric-label">Catalog endpoints</span>
              <span className="metric-icon orange" aria-hidden>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="7" height="7" rx="1" />
                  <rect x="14" y="3" width="7" height="7" rx="1" />
                  <rect x="14" y="14" width="7" height="7" rx="1" />
                  <rect x="3" y="14" width="7" height="7" rx="1" />
                </svg>
              </span>
            </div>
            <div className="metric-value">{stats.endpointCount.toLocaleString()}</div>
            <p className="metric-hint">
              <a href={`${GATEWAY_BASE_URL}/v1/catalog`}>View JSON catalog →</a>
            </p>
          </article>
        </div>

        <div className="rate-row" aria-label="Payment success rate">
          <span>Payment success rate</span>
          <div className="rate-bar" role="presentation">
            <div className="rate-bar-fill" style={{ width: total === 0 ? "0%" : `${successPct}%` }} />
          </div>
          <span>{successLabel}</span>
        </div>
      </section>

      <section className="panel" aria-labelledby="payments-heading">
        <div className="panel-head">
          <h2 id="payments-heading" className="section-label">
            Recent payments
          </h2>
          <span className="panel-meta">
            Last {recent.length} events · Timestamps UTC · Gateway{" "}
            <span className="mono">{GATEWAY_BASE_URL.replace(/^https?:\/\//, "")}</span>
          </span>
        </div>

        {recent.length === 0 ? (
          <div className="empty-panel">
            <strong>No payments recorded yet.</strong>
            <br />
            Run an agent with{" "}
            <a href={NPM_SDK_URL} target="_blank" rel="noreferrer">
              @swarm-api/sdk
            </a>{" "}
            or open the{" "}
            <a href={`${LANDING_ORIGIN}/#install`}>install guide</a> to wire MCP — successful calls appear here
            instantly.
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Time</th>
                  <th scope="col">Resource</th>
                  <th scope="col">Status</th>
                  <th scope="col">Payer</th>
                  <th scope="col">Amount</th>
                  <th scope="col">Tx / error</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((p) => (
                  <tr key={p.id}>
                    <td className="mono">{formatTime(p.createdAt)}</td>
                    <td className="mono">
                      {p.method} {p.resource}
                    </td>
                    <td>
                      <span className={`status-pill ${p.status === "settled" ? "status-settled" : "status-failed"}`}>
                        {p.status}
                      </span>
                    </td>
                    <td className="mono">{shortAddr(p.payerAddress)}</td>
                    <td className="mono">{formatUsdc(p.amountAtomic)}</td>
                    <td>
                      <TxCell p={p} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
