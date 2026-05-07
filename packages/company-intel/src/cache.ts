import { eq } from "drizzle-orm";
import { cache, type DB } from "@agentpay/db";

export async function fetchJsonCached<T>(
  db: DB,
  url: string,
  ttlMs: number,
  init?: RequestInit,
): Promise<T> {
  const key = url;
  const row = db.select().from(cache).where(eq(cache.key, key)).get();
  if (row && row.expiresAt.getTime() > Date.now()) {
    return JSON.parse(row.value) as T;
  }

  const res = await fetch(url, init);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new UpstreamError(
      `Upstream ${res.status} ${res.statusText} for ${url}${body ? `: ${body.slice(0, 200)}` : ""}`,
      res.status,
    );
  }
  const data = (await res.json()) as T;

  const value = JSON.stringify(data);
  const expiresAt = new Date(Date.now() + ttlMs);
  db.insert(cache)
    .values({ key, value, expiresAt })
    .onConflictDoUpdate({ target: cache.key, set: { value, expiresAt } })
    .run();

  return data;
}

export class UpstreamError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "UpstreamError";
  }
}
