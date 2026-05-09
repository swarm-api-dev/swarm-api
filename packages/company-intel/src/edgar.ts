import type { DB } from "@swarmapi/db";
import { fetchJsonCached, fetchTextCached } from "./cache";

const USER_AGENT = process.env.EDGAR_USER_AGENT ?? "SwarmApi info@swarmapi.ai";

const TICKERS_URL = "https://www.sec.gov/files/company_tickers.json";
const TTL_TICKERS_MS = 24 * 60 * 60 * 1000;
const TTL_SUBMISSIONS_MS = 60 * 60 * 1000;

const edgarHeaders: Record<string, string> = {
  "User-Agent": USER_AGENT,
  Accept: "application/json",
};

export interface TickerEntry {
  cik_str: number;
  ticker: string;
  title: string;
}

export type CompanyTickersResponse = Record<string, TickerEntry>;

export async function fetchCompanyTickers(db: DB): Promise<CompanyTickersResponse> {
  return fetchJsonCached<CompanyTickersResponse>(db, TICKERS_URL, TTL_TICKERS_MS, {
    headers: edgarHeaders,
  });
}

export interface EdgarSubmissions {
  cik: string;
  name: string;
  tickers?: string[];
  exchanges?: string[];
  filings: {
    recent: {
      accessionNumber: string[];
      filingDate: string[];
      reportDate: string[];
      form: string[];
      primaryDocument: string[];
      primaryDocDescription: string[];
    };
  };
}

export async function fetchSubmissions(db: DB, cik: string): Promise<EdgarSubmissions> {
  const padded = cik.padStart(10, "0");
  const url = `https://data.sec.gov/submissions/CIK${padded}.json`;
  return fetchJsonCached<EdgarSubmissions>(db, url, TTL_SUBMISSIONS_MS, {
    headers: edgarHeaders,
  });
}

export function padCik(cik: string | number): string {
  return String(cik).padStart(10, "0");
}

export function filingPrimaryDocUrl(cik: string, accession: string, primaryDoc: string): string {
  const cleanedAccession = accession.replace(/-/g, "");
  return `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${cleanedAccession}/${primaryDoc}`;
}

export interface EdgarFilingIndex {
  directory: {
    item: Array<{ name: string; type: string; size?: number }>;
  };
}

const TTL_FILING_INDEX_MS = 7 * 24 * 60 * 60 * 1000;
const TTL_FILING_HTML_MS = 7 * 24 * 60 * 60 * 1000;

export function cikFromAccession(accession: string): string {
  const parts = accession.split("-");
  if (parts.length === 0 || !parts[0]) {
    throw new Error(`Invalid accession number: ${accession}`);
  }
  return parts[0];
}

export async function fetchFilingIndex(db: DB, accession: string): Promise<EdgarFilingIndex> {
  const cik = Number(cikFromAccession(accession));
  const noDashes = accession.replace(/-/g, "");
  const url = `https://www.sec.gov/Archives/edgar/data/${cik}/${noDashes}/index.json`;
  return fetchJsonCached<EdgarFilingIndex>(db, url, TTL_FILING_INDEX_MS, {
    headers: edgarHeaders,
  });
}

export function findPrimaryDoc(
  index: EdgarFilingIndex,
): { name: string; type: string } | null {
  const items = index.directory.item;
  const isHtml = (n: string) => /\.html?$/i.test(n);
  const isIndex = (n: string) => /-index(-headers)?\.html?$/i.test(n);
  const isExhibit = (n: string) =>
    /(^|[\-_])ex[\-_]?\d/i.test(n) || /(^|[\-_])exhibit/i.test(n);
  const isXbrlReport = (n: string) => /^R\d+\.html?$/i.test(n);

  const candidates = items.filter(
    (i) =>
      isHtml(i.name) &&
      !isIndex(i.name) &&
      !isExhibit(i.name) &&
      !isXbrlReport(i.name),
  );
  if (candidates.length === 0) return null;

  const canonical = candidates.find((c) =>
    /^[a-z][a-z0-9]*-?\d{8}\.html?$/i.test(c.name),
  );
  if (canonical) return canonical;

  candidates.sort((a, b) => Number(a.size ?? 0) - Number(b.size ?? 0));
  return candidates[0] ?? null;
}

export async function fetchFilingHtml(
  db: DB,
  accession: string,
  primaryDocName: string,
): Promise<string> {
  const cik = Number(cikFromAccession(accession));
  const noDashes = accession.replace(/-/g, "");
  const url = `https://www.sec.gov/Archives/edgar/data/${cik}/${noDashes}/${primaryDocName}`;
  return fetchTextCached(db, url, TTL_FILING_HTML_MS, { headers: edgarHeaders });
}
