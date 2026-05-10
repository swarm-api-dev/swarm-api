import type { DB } from "@swarmapi/db";
import { fetchJsonCached } from "./cache";

const GDELT_DOC_URL = "https://api.gdeltproject.org/api/v2/doc/doc";
const TTL_NEWS_MS = 15 * 60 * 1000;

export interface NewsArticle {
  title: string;
  url: string;
  domain: string;
  publishedAt: string | null;
  language: string | null;
  country: string | null;
  socialImage: string | null;
}

export interface ListNewsResponse {
  query: string;
  since: string | null;
  until: string | null;
  count: number;
  articles: NewsArticle[];
}

export interface ListNewsOptions {
  since?: string;
  until?: string;
  limit?: number;
  language?: string;
}

interface GdeltArticle {
  url?: string;
  title?: string;
  seendate?: string;
  domain?: string;
  language?: string;
  sourcecountry?: string;
  socialimage?: string;
}

interface GdeltResponse {
  articles?: GdeltArticle[];
}

export async function listNews(
  db: DB,
  query: string,
  opts: ListNewsOptions = {},
): Promise<ListNewsResponse> {
  const limit = Math.max(1, Math.min(opts.limit ?? 25, 75));
  const language = opts.language ?? "english";

  const params = new URLSearchParams({
    query: `"${query}" sourcelang:${language}`,
    mode: "ArtList",
    format: "json",
    sort: "DateDesc",
    maxrecords: String(limit),
  });

  const sinceStamp = opts.since ? toGdeltDateTime(opts.since, false) : null;
  const untilStamp = opts.until ? toGdeltDateTime(opts.until, true) : null;
  if (sinceStamp) params.set("startdatetime", sinceStamp);
  if (untilStamp) params.set("enddatetime", untilStamp);
  if (!sinceStamp && !untilStamp) params.set("timespan", "30d");

  const url = `${GDELT_DOC_URL}?${params.toString()}`;
  const data = await fetchJsonCached<GdeltResponse>(db, url, TTL_NEWS_MS, {
    headers: { "User-Agent": "SwarmApi info@swarm-api.com" },
  });

  const articles: NewsArticle[] = (data.articles ?? []).map((a) => ({
    title: (a.title ?? "").trim(),
    url: a.url ?? "",
    domain: a.domain ?? "",
    publishedAt: gdeltDateToIso(a.seendate ?? null),
    language: a.language ?? null,
    country: a.sourcecountry ?? null,
    socialImage: a.socialimage && a.socialimage.length > 0 ? a.socialimage : null,
  }));

  return {
    query,
    since: opts.since ?? null,
    until: opts.until ?? null,
    count: articles.length,
    articles,
  };
}

function toGdeltDateTime(iso: string, endOfDay: boolean): string | null {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  return endOfDay ? `${m[1]}${m[2]}${m[3]}235959` : `${m[1]}${m[2]}${m[3]}000000`;
}

function gdeltDateToIso(stamp: string | null): string | null {
  if (!stamp) return null;
  const m = stamp.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z?$/);
  if (!m) return null;
  return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z`;
}
