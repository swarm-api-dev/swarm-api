import path from "node:path";
import { createDb, ensureSchema, type DB } from "@agentpay/db";

let cached: DB | null = null;

export function getDb(): DB {
  if (cached) return cached;
  const repoRoot = path.resolve(process.cwd(), "../..");
  const dbPath = process.env.DB_PATH ?? path.resolve(repoRoot, "agentpay.sqlite");
  const db = createDb(dbPath);
  ensureSchema(db);
  cached = db;
  return db;
}
