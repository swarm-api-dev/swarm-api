import type { DB } from "@swarmapi/db";
import { fetchJsonCached, UpstreamError } from "./cache";

const BRAVE_URL = "https://api.search.brave.com/res/v1/web/search";
const TTL_SEARCH_MS = 60 * 60 * 1000;

export interface SearchResult {
  title: string;
  url: string;
  description: string;
  domain: string;
  publishedAt: string | null;
}

export interface WebSearchResponse {
  query: string;
  count: number;
  results: SearchResult[];
}

export interface WebSearchOptions {
  count?: number;
  country?: string;
  freshness?: string;
  language?: string;
}

interface BraveWebResultRaw {
  title?: string;
  url?: string;
  description?: string;
  meta_url?: { hostname?: string };
  age?: string;
  page_age?: string;
}

interface BraveSearchResponse {
  web?: { results?: BraveWebResultRaw[] };
}

export async function webSearch(
  db: DB,
  query: string,
  apiKey: string,
  opts: WebSearchOptions = {},
): Promise<WebSearchResponse> {
  if (!apiKey) {
    throw new UpstreamError(
      "Brave Search API key not configured. Set BRAVE_API_KEY in the gateway env.",
      503,
    );
  }
  const count = Math.max(1, Math.min(opts.count ?? 10, 20));
  const params = new URLSearchParams({
    q: query,
    count: String(count),
  });
  if (opts.country) params.set("country", opts.country);
  if (opts.freshness) params.set("freshness", opts.freshness);
  if (opts.language) params.set("search_lang", opts.language);

  const url = `${BRAVE_URL}?${params.toString()}`;
  const data = await fetchJsonCached<BraveSearchResponse>(db, url, TTL_SEARCH_MS, {
    headers: {
      "X-Subscription-Token": apiKey,
      Accept: "application/json",
      "User-Agent": "SwarmApi info@swarmapi.ai",
    },
  });

  const results: SearchResult[] = (data.web?.results ?? []).map((r) => ({
    title: (r.title ?? "").trim(),
    url: r.url ?? "",
    description: stripTags((r.description ?? "").trim()),
    domain: r.meta_url?.hostname ?? domainOf(r.url ?? ""),
    publishedAt: r.page_age ?? r.age ?? null,
  }));

  return { query, count: results.length, results };
}

function stripTags(s: string): string {
  return s.replace(/<[^>]*>/g, "");
}

function domainOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}
