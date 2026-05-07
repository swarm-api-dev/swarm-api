import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import { endpoints } from "./schema";

export * from "./schema";

export type DB = ReturnType<typeof createDb>;

export function createDb(dbPath: string) {
  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  return drizzle(sqlite, { schema });
}

export function ensureSchema(db: DB) {
  db.$client.exec(`
    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      method TEXT NOT NULL,
      resource TEXT NOT NULL,
      status TEXT NOT NULL,
      payer_address TEXT,
      pay_to TEXT,
      asset TEXT,
      network TEXT,
      amount_atomic TEXT,
      tx_hash TEXT,
      error_code TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS payments_status_idx ON payments(status);
    CREATE INDEX IF NOT EXISTS payments_created_at_idx ON payments(created_at);

    CREATE TABLE IF NOT EXISTS endpoints (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      method TEXT NOT NULL,
      resource TEXT NOT NULL,
      price_atomic TEXT NOT NULL,
      asset TEXT NOT NULL,
      network TEXT NOT NULL,
      pay_to TEXT NOT NULL,
      gateway_url TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);
}

export interface EndpointInput {
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

export function upsertEndpoint(db: DB, e: EndpointInput) {
  const now = new Date();
  db.insert(endpoints)
    .values({ ...e, createdAt: now, updatedAt: now })
    .onConflictDoUpdate({
      target: endpoints.id,
      set: {
        name: e.name,
        description: e.description,
        method: e.method,
        resource: e.resource,
        priceAtomic: e.priceAtomic,
        asset: e.asset,
        network: e.network,
        payTo: e.payTo,
        gatewayUrl: e.gatewayUrl,
        updatedAt: now,
      },
    })
    .run();
}
