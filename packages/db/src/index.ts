import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";

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
  `);
}
