import { eq } from "drizzle-orm";
import { cache, type DB } from "@agentpay/db";

export async function fetchJsonCached<T>(
  db: DB,
  url: string,
  ttlMs: number,
  init?: RequestInit,
): Promise<T> {
  const key = `json:${url}`;
  const row = db.select().from(cache).where(eq(cache.key, key)).get();
  if (row && row.expiresAt.getTime() > Date.now()) {
    return JSON.parse(row.value) as T;
  }

  const res = await upstreamFetch(url, init);
  const data = (await res.json()) as T;

  const value = JSON.stringify(data);
  const expiresAt = new Date(Date.now() + ttlMs);
  db.insert(cache)
    .values({ key, value, expiresAt })
    .onConflictDoUpdate({ target: cache.key, set: { value, expiresAt } })
    .run();

  return data;
}

export async function fetchTextCached(
  db: DB,
  url: string,
  ttlMs: number,
  init?: RequestInit,
): Promise<string> {
  const key = `text:${url}`;
  const row = db.select().from(cache).where(eq(cache.key, key)).get();
  if (row && row.expiresAt.getTime() > Date.now()) {
    return row.value;
  }

  const res = await upstreamFetch(url, init);
  const text = await res.text();

  const expiresAt = new Date(Date.now() + ttlMs);
  db.insert(cache)
    .values({ key, value: text, expiresAt })
    .onConflictDoUpdate({ target: cache.key, set: { value: text, expiresAt } })
    .run();

  return text;
}

async function upstreamFetch(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeoutMs = 30_000;
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new UpstreamError(
        `Upstream ${res.status} ${res.statusText} for ${url}${body ? `: ${body.slice(0, 200)}` : ""}`,
        res.status,
      );
    }
    return res;
  } catch (err) {
    if (err instanceof UpstreamError) throw err;
    if (err instanceof Error && err.name === "AbortError") {
      throw new UpstreamError(`Upstream timeout after ${timeoutMs}ms for ${url}`, 504);
    }
    throw new UpstreamError(`Upstream fetch failed for ${url}: ${(err as Error).message}`, 502);
  } finally {
    clearTimeout(timer);
  }
}

export class UpstreamError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "UpstreamError";
  }
}
