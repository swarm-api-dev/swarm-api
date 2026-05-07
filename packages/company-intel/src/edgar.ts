import type { DB } from "@agentpay/db";
import { fetchJsonCached } from "./cache";

const USER_AGENT = process.env.EDGAR_USER_AGENT ?? "AgentPay info@agentpay.ai";

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
