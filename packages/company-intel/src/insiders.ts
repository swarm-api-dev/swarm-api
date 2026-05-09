import { XMLParser } from "fast-xml-parser";
import type { DB } from "@swarmapi/db";
import { fetchJsonCached, fetchTextCached, UpstreamError } from "./cache";
import { padCik, type EdgarFilingIndex } from "./edgar";
import { listFilings } from "./filings";

const TTL_FORM4_INDEX_MS = 7 * 24 * 60 * 60 * 1000;
const TTL_FORM4_XML_MS = 7 * 24 * 60 * 60 * 1000;
const EDGAR_HEADERS = { "User-Agent": "SwarmApi info@swarmapi.ai" } as const;

const TRANSACTION_CODES: Record<string, string> = {
  P: "Open-market purchase",
  S: "Open-market sale",
  A: "Grant or award",
  D: "Sale or disposition",
  F: "Tax withholding",
  M: "Derivative exercise",
  X: "In-the-money derivative exercise",
  G: "Bona fide gift",
  J: "Other",
  W: "Will or inheritance",
  I: "Discretionary transaction",
  V: "Voluntary",
  C: "Conversion of derivative",
  E: "Expired short-term derivative",
  H: "Cancellation of derivative",
  K: "Equity swap or similar",
  O: "Out-of-the-money derivative exercise",
  Z: "Voting trust deposit",
};

export interface InsiderTransaction {
  filing: { accession: string; filedAt: string };
  insider: {
    name: string;
    cik: string | null;
    title: string | null;
    isDirector: boolean;
    isOfficer: boolean;
    isTenPercentOwner: boolean;
  };
  isDerivative: boolean;
  securityTitle: string;
  transactionDate: string | null;
  transactionCode: string | null;
  transactionType: string | null;
  acquired: boolean | null;
  shares: string | null;
  pricePerShare: string | null;
  value: string | null;
  sharesAfter: string | null;
}

export interface ListInsidersResponse {
  company: { cik: string };
  since: string | null;
  until: string | null;
  count: number;
  transactions: InsiderTransaction[];
}

export interface ListInsidersOptions {
  since?: string;
  until?: string;
  limit?: number;
}

export async function listInsiderTransactions(
  db: DB,
  cik: string,
  opts: ListInsidersOptions = {},
): Promise<ListInsidersResponse> {
  const padded = padCik(cik);
  const limit = Math.max(1, Math.min(opts.limit ?? 10, 50));

  const filings = await listFilings(db, padded, {
    types: ["4"],
    since: opts.since,
    limit,
  });

  const issuerCikNum = Number(padded);
  const filingResults = await Promise.all(
    filings.filings.map(async (f) => {
      try {
        const xmlDoc = await fetchForm4Xml(db, f.accession, issuerCikNum);
        if (!xmlDoc) return [];
        return parseForm4(xmlDoc, { accession: f.accession, filedAt: f.filedAt });
      } catch (err) {
        if (err instanceof UpstreamError && err.status === 404) return [];
        throw err;
      }
    }),
  );

  let transactions = filingResults.flat();

  if (opts.until) {
    const untilMs = Date.parse(opts.until);
    if (!Number.isNaN(untilMs)) {
      transactions = transactions.filter((t) => {
        if (!t.transactionDate) return true;
        return Date.parse(t.transactionDate) <= untilMs;
      });
    }
  }

  return {
    company: { cik: padded },
    since: opts.since ?? null,
    until: opts.until ?? null,
    count: transactions.length,
    transactions,
  };
}

async function fetchForm4Xml(
  db: DB,
  accession: string,
  issuerCikNum: number,
): Promise<string | null> {
  const noDashes = accession.replace(/-/g, "");
  const indexUrl = `https://www.sec.gov/Archives/edgar/data/${issuerCikNum}/${noDashes}/index.json`;
  const index = await fetchJsonCached<EdgarFilingIndex>(db, indexUrl, TTL_FORM4_INDEX_MS, {
    headers: EDGAR_HEADERS,
  });
  const xmlDoc = index.directory.item.find(
    (i) => /\.xml$/i.test(i.name) && !/^Form|R\d+/.test(i.name) && !/_lab|_def|_pre|_cal|_htm/.test(i.name),
  );
  if (!xmlDoc) return null;
  const url = `https://www.sec.gov/Archives/edgar/data/${issuerCikNum}/${noDashes}/${xmlDoc.name}`;
  return fetchTextCached(db, url, TTL_FORM4_XML_MS, {
    headers: { ...EDGAR_HEADERS, Accept: "application/xml" },
  });
}

function parseForm4(
  xml: string,
  filing: { accession: string; filedAt: string },
): InsiderTransaction[] {
  const parser = new XMLParser({
    ignoreAttributes: true,
    parseTagValue: false,
    parseAttributeValue: false,
    trimValues: true,
  });
  const parsed = parser.parse(xml);
  const doc = parsed?.ownershipDocument;
  if (!doc) return [];

  const owners = toArray(doc.reportingOwner);
  const insider = owners.length > 0 ? extractInsider(owners[0]) : null;
  if (!insider) return [];

  const out: InsiderTransaction[] = [];

  const nonDeriv = toArray(doc.nonDerivativeTable?.nonDerivativeTransaction);
  for (const t of nonDeriv) {
    const tx = parseTransaction(t, false, filing, insider);
    if (tx) out.push(tx);
  }

  const deriv = toArray(doc.derivativeTable?.derivativeTransaction);
  for (const t of deriv) {
    const tx = parseTransaction(t, true, filing, insider);
    if (tx) out.push(tx);
  }

  return out;
}

interface ParsedInsider {
  name: string;
  cik: string | null;
  title: string | null;
  isDirector: boolean;
  isOfficer: boolean;
  isTenPercentOwner: boolean;
}

function extractInsider(owner: unknown): ParsedInsider | null {
  if (!owner || typeof owner !== "object") return null;
  const o = owner as Record<string, unknown>;
  const id = (o.reportingOwnerId ?? {}) as Record<string, unknown>;
  const rel = (o.reportingOwnerRelationship ?? {}) as Record<string, unknown>;
  return {
    name: stringOf(id.rptOwnerName) ?? "Unknown",
    cik: stringOf(id.rptOwnerCik),
    title: stringOf(rel.officerTitle),
    isDirector: boolFlag(rel.isDirector),
    isOfficer: boolFlag(rel.isOfficer),
    isTenPercentOwner: boolFlag(rel.isTenPercentOwner),
  };
}

function parseTransaction(
  t: unknown,
  isDerivative: boolean,
  filing: { accession: string; filedAt: string },
  insider: ParsedInsider,
): InsiderTransaction | null {
  if (!t || typeof t !== "object") return null;
  const tx = t as Record<string, unknown>;
  const securityTitle = pickValue(tx.securityTitle) ?? "Unknown security";
  const transactionDate = pickValue(tx.transactionDate);
  const coding = (tx.transactionCoding ?? {}) as Record<string, unknown>;
  const code = stringOf(coding.transactionCode);
  const amounts = (tx.transactionAmounts ?? {}) as Record<string, unknown>;
  const shares = pickValue(amounts.transactionShares);
  const pricePerShare = pickValue(amounts.transactionPricePerShare);
  const acquiredCode = pickValue(amounts.transactionAcquiredDisposedCode);
  const post = (tx.postTransactionAmounts ?? {}) as Record<string, unknown>;
  const sharesAfter = pickValue(post.sharesOwnedFollowingTransaction);

  let value: string | null = null;
  if (shares && pricePerShare) {
    const sharesNum = Number(shares);
    const priceNum = Number(pricePerShare);
    if (!Number.isNaN(sharesNum) && !Number.isNaN(priceNum)) {
      value = (sharesNum * priceNum).toFixed(2);
    }
  }

  return {
    filing,
    insider,
    isDerivative,
    securityTitle,
    transactionDate,
    transactionCode: code,
    transactionType: code ? TRANSACTION_CODES[code] ?? code : null,
    acquired: acquiredCode ? acquiredCode.toUpperCase() === "A" : null,
    shares,
    pricePerShare,
    value,
    sharesAfter,
  };
}

function toArray<T>(v: T | T[] | undefined): T[] {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}

function stringOf(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "string") return v.trim() || null;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return null;
}

function boolFlag(v: unknown): boolean {
  const s = stringOf(v);
  if (!s) return false;
  return s === "1" || s.toLowerCase() === "true";
}

function pickValue(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "string") return v.trim() || null;
  if (typeof v === "object" && "value" in (v as Record<string, unknown>)) {
    return stringOf((v as Record<string, unknown>).value);
  }
  return null;
}
