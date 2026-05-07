import type { DB } from "@agentpay/db";
import { fetchCompanyTickers, padCik } from "./edgar";

export interface CompanyMatch {
  id: string;
  name: string;
  ticker: string | null;
  cik: string;
  match: "ticker" | "cik" | "name";
  confidence: number;
}

export interface ResolveResponse {
  query: string;
  matches: CompanyMatch[];
}

const TICKER_RE = /^[A-Z][A-Z0-9.\-]{0,9}$/;
const CIK_RE = /^\d{1,10}$/;

export async function resolveCompany(db: DB, rawQuery: string): Promise<ResolveResponse> {
  const query = rawQuery.trim();
  const tickers = await fetchCompanyTickers(db);
  const entries = Object.values(tickers);

  const matches: CompanyMatch[] = [];

  if (TICKER_RE.test(query.toUpperCase())) {
    const upper = query.toUpperCase();
    for (const e of entries) {
      if (e.ticker.toUpperCase() === upper) {
        matches.push({
          id: padCik(e.cik_str),
          name: e.title,
          ticker: e.ticker,
          cik: padCik(e.cik_str),
          match: "ticker",
          confidence: 1,
        });
      }
    }
  }

  if (matches.length === 0 && CIK_RE.test(query)) {
    const cikN = Number(query);
    for (const e of entries) {
      if (e.cik_str === cikN) {
        matches.push({
          id: padCik(e.cik_str),
          name: e.title,
          ticker: e.ticker,
          cik: padCik(e.cik_str),
          match: "cik",
          confidence: 1,
        });
      }
    }
  }

  if (matches.length === 0) {
    const folded = foldName(query);
    const scored: { entry: (typeof entries)[number]; score: number }[] = [];
    for (const e of entries) {
      const titleFolded = foldName(e.title);
      if (titleFolded === folded) {
        scored.push({ entry: e, score: 1 });
        continue;
      }
      if (titleFolded.startsWith(folded) || folded.startsWith(titleFolded)) {
        scored.push({ entry: e, score: 0.85 });
        continue;
      }
      if (titleFolded.includes(folded) || folded.includes(titleFolded)) {
        scored.push({ entry: e, score: 0.7 });
      }
    }
    scored.sort((a, b) => b.score - a.score);
    for (const s of scored.slice(0, 5)) {
      matches.push({
        id: padCik(s.entry.cik_str),
        name: s.entry.title,
        ticker: s.entry.ticker,
        cik: padCik(s.entry.cik_str),
        match: "name",
        confidence: s.score,
      });
    }
  }

  return { query, matches };
}

function foldName(s: string): string {
  return s
    .toLowerCase()
    .replace(/[.,&'"]/g, "")
    .replace(/\b(inc|corp|corporation|company|co|ltd|limited|llc|plc|holdings|group)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
