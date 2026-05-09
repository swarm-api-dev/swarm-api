import type { DB } from "@swarmapi/db";
import { fetchSubmissions, filingPrimaryDocUrl, padCik } from "./edgar";

export interface FilingRecord {
  accession: string;
  form: string;
  filedAt: string;
  reportedAt: string | null;
  primaryDocUrl: string;
  description: string;
}

export interface ListFilingsOptions {
  types?: string[];
  since?: string;
  limit?: number;
}

export interface ListFilingsResponse {
  company: { cik: string; name: string; tickers: string[] };
  filings: FilingRecord[];
}

export async function listFilings(
  db: DB,
  cik: string,
  opts: ListFilingsOptions = {},
): Promise<ListFilingsResponse> {
  const padded = padCik(cik);
  const sub = await fetchSubmissions(db, padded);
  const recent = sub.filings.recent;

  const limit = Math.max(1, Math.min(opts.limit ?? 20, 100));
  const typeSet =
    opts.types && opts.types.length > 0 ? new Set(opts.types.map((t) => t.toUpperCase())) : null;
  const sinceMs = opts.since ? Date.parse(opts.since) : null;

  const filings: FilingRecord[] = [];
  for (let i = 0; i < recent.accessionNumber.length; i++) {
    const form = recent.form[i] ?? "";
    const filed = recent.filingDate[i] ?? "";
    const accession = recent.accessionNumber[i] ?? "";
    const primaryDoc = recent.primaryDocument[i] ?? "";
    const desc = recent.primaryDocDescription[i] ?? form;

    if (typeSet && !typeSet.has(form.toUpperCase())) continue;
    if (sinceMs !== null && Date.parse(filed) < sinceMs) continue;

    filings.push({
      accession,
      form,
      filedAt: filed,
      reportedAt: recent.reportDate[i] || null,
      primaryDocUrl: filingPrimaryDocUrl(padded, accession, primaryDoc),
      description: desc,
    });

    if (filings.length >= limit) break;
  }

  return {
    company: { cik: padded, name: sub.name, tickers: sub.tickers ?? [] },
    filings,
  };
}
