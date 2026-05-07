import { sql } from "drizzle-orm";
import { desc } from "drizzle-orm";
import { payments, type Payment } from "@agentpay/db";
import { getDb } from "../lib/db";

export const dynamic = "force-dynamic";

const USDC_DECIMALS = 6n;

function formatUsdc(atomic: string | null): string {
  if (!atomic) return "—";
  try {
    const value = BigInt(atomic);
    const whole = value / 10n ** USDC_DECIMALS;
    const frac = value % 10n ** USDC_DECIMALS;
    return `$${whole}.${frac.toString().padStart(6, "0")}`;
  } catch {
    return atomic;
  }
}

function shortAddr(addr: string | null): string {
  if (!addr) return "—";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function formatTime(ts: Date | null): string {
  if (!ts) return "—";
  return ts.toISOString().replace("T", " ").slice(0, 19);
}

async function loadStats() {
  const db = getDb();
  const counts = db
    .select({
      status: payments.status,
      count: sql<number>`COUNT(*)`,
      sumAtomic: sql<string>`COALESCE(SUM(CAST(${payments.amountAtomic} AS INTEGER)), 0)`,
    })
    .from(payments)
    .groupBy(payments.status)
    .all();

  const settled = counts.find((c) => c.status === "settled");
  const failed = counts.find((c) => c.status === "failed");

  return {
    settledCount: Number(settled?.count ?? 0),
    failedCount: Number(failed?.count ?? 0),
    revenueAtomic: String(settled?.sumAtomic ?? 0),
  };
}

async function loadRecent(limit = 50): Promise<Payment[]> {
  const db = getDb();
  return db.select().from(payments).orderBy(desc(payments.createdAt)).limit(limit).all();
}

export default async function DashboardPage() {
  const [stats, recent] = await Promise.all([loadStats(), loadRecent()]);
  const total = stats.settledCount + stats.failedCount;
  const successRate = total === 0 ? "—" : `${((stats.settledCount / total) * 100).toFixed(0)}%`;

  return (
    <main>
      <h1>AgentPay dashboard</h1>
      <p className="subtitle">Payment events recorded by the gateway.</p>

      <h2>Stats</h2>
      <div className="stats">
        <div className="stat">
          <div className="label">Revenue (USDC)</div>
          <div className="value">{formatUsdc(stats.revenueAtomic)}</div>
        </div>
        <div className="stat">
          <div className="label">Settled</div>
          <div className="value">{stats.settledCount}</div>
        </div>
        <div className="stat">
          <div className="label">Failed</div>
          <div className="value">{stats.failedCount}</div>
        </div>
        <div className="stat">
          <div className="label">Success rate</div>
          <div className="value">{successRate}</div>
        </div>
      </div>

      <h2>Recent payments</h2>
      {recent.length === 0 ? (
        <div className="empty">No payments yet. Run the example agent to generate events.</div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>Resource</th>
              <th>Status</th>
              <th>Payer</th>
              <th>Amount</th>
              <th>Tx / Error</th>
            </tr>
          </thead>
          <tbody>
            {recent.map((p) => (
              <tr key={p.id}>
                <td className="mono">{formatTime(p.createdAt)}</td>
                <td className="mono">
                  {p.method} {p.resource}
                </td>
                <td className={p.status === "settled" ? "status-settled" : "status-failed"}>
                  {p.status}
                </td>
                <td className="mono">{shortAddr(p.payerAddress)}</td>
                <td className="mono">{formatUsdc(p.amountAtomic)}</td>
                <td className="mono">{p.txHash ? shortAddr(p.txHash) : (p.errorCode ?? "—")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
