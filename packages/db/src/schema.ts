import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

export const payments = sqliteTable(
  "payments",
  {
    id: text("id").primaryKey(),
    method: text("method").notNull(),
    resource: text("resource").notNull(),
    status: text("status", { enum: ["settled", "failed"] }).notNull(),
    payerAddress: text("payer_address"),
    payTo: text("pay_to"),
    asset: text("asset"),
    network: text("network"),
    amountAtomic: text("amount_atomic"),
    txHash: text("tx_hash"),
    errorCode: text("error_code"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => ({
    statusIdx: index("payments_status_idx").on(t.status),
    createdAtIdx: index("payments_created_at_idx").on(t.createdAt),
  }),
);

export type Payment = typeof payments.$inferSelect;
export type NewPayment = typeof payments.$inferInsert;
