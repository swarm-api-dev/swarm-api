import { parseHTML } from "linkedom";
import type { DB } from "@swarmapi/db";
import {
  cikFromAccession,
  fetchFilingHtml,
  fetchFilingIndex,
  findPrimaryDoc,
} from "./edgar";

export interface ExtractedItem {
  title: string;
  text: string;
}

export interface ExtractFilingResponse {
  filing: {
    accession: string;
    cik: string;
    primaryDocUrl: string;
  };
  items: Record<string, ExtractedItem>;
  meta: {
    parserVersion: string;
    itemCount: number;
    textLength: number;
    truncatedItems: string[];
  };
}

export interface ExtractFilingOptions {
  items?: string[];
  perItemMaxBytes?: number;
}

const PARSER_VERSION = "0.2";
const DEFAULT_PER_ITEM_MAX_BYTES = 150_000;
const HEADING_RE = /^\s*ITEM\s+(\d+(?:\.\d+)?[A-Z]?)[\s\.\-–—:]+(\S.+?)\s*\.?$/i;
const MAX_HEADING_LEN = 300;

export async function extractFiling(
  db: DB,
  accession: string,
  opts: ExtractFilingOptions = {},
): Promise<ExtractFilingResponse> {
  const cik = cikFromAccession(accession);
  const index = await fetchFilingIndex(db, accession);
  const primary = findPrimaryDoc(index);
  if (!primary) {
    throw new Error(`No primary document found for ${accession}`);
  }
  const noDashes = accession.replace(/-/g, "");
  const primaryDocUrl = `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${noDashes}/${primary.name}`;
  const html = await fetchFilingHtml(db, accession, primary.name);

  const { document } = parseHTML(html);
  const lines = collectBlockLines(document.body ?? document.documentElement);

  const headings: Array<{ lineIdx: number; item: string; title: string }> = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (line.length === 0 || line.length > MAX_HEADING_LEN) continue;
    const m = HEADING_RE.exec(line);
    if (!m) continue;
    const itemRaw = m[1];
    const titleRaw = m[2];
    if (!itemRaw || !titleRaw) continue;
    headings.push({
      lineIdx: i,
      item: itemRaw.toUpperCase(),
      title: cleanTitle(titleRaw),
    });
  }

  const wantSet =
    opts.items && opts.items.length > 0
      ? new Set(opts.items.map((s) => s.toUpperCase()))
      : null;
  const perItemMax = opts.perItemMaxBytes ?? DEFAULT_PER_ITEM_MAX_BYTES;

  const byItem = new Map<
    string,
    { title: string; text: string; bodyLen: number; truncated: boolean }
  >();
  for (let i = 0; i < headings.length; i++) {
    const cur = headings[i]!;
    if (wantSet && !wantSet.has(cur.item)) continue;
    const startLine = cur.lineIdx + 1;
    const endLine = i + 1 < headings.length ? headings[i + 1]!.lineIdx : lines.length;
    const body = lines.slice(startLine, endLine).join("\n").trim();
    const existing = byItem.get(cur.item);
    if (existing && existing.bodyLen >= body.length) continue;

    const truncated = body.length > perItemMax;
    const text = truncated ? body.slice(0, perItemMax) : body;
    byItem.set(cur.item, {
      title: cur.title,
      text,
      bodyLen: body.length,
      truncated,
    });
  }

  const items: Record<string, ExtractedItem> = {};
  const truncatedItems: string[] = [];
  let totalLen = 0;
  for (const [code, entry] of byItem) {
    items[code] = { title: entry.title, text: entry.text };
    totalLen += entry.text.length;
    if (entry.truncated) truncatedItems.push(code);
  }

  return {
    filing: { accession, cik, primaryDocUrl },
    items,
    meta: {
      parserVersion: PARSER_VERSION,
      itemCount: Object.keys(items).length,
      textLength: totalLen,
      truncatedItems,
    },
  };
}

const BLOCK_TAGS = new Set([
  "DIV",
  "P",
  "H1",
  "H2",
  "H3",
  "H4",
  "H5",
  "H6",
  "TD",
  "TR",
  "LI",
  "UL",
  "OL",
  "TABLE",
  "SECTION",
  "ARTICLE",
  "HEADER",
  "FOOTER",
  "BLOCKQUOTE",
  "PRE",
  "BR",
]);

function collectBlockLines(root: Node | null): string[] {
  if (!root) return [];
  const buf: string[] = [];
  const cur: string[] = [];
  const flush = () => {
    if (cur.length === 0) return;
    const line = cur
      .join("")
      .replace(/[ \t ]+/g, " ")
      .trim();
    cur.length = 0;
    if (line) buf.push(line);
  };
  const walk = (n: Node) => {
    if (n.nodeType === 3) {
      cur.push(n.textContent ?? "");
      return;
    }
    if (n.nodeType !== 1) return;
    const el = n as Element;
    const isBlock = BLOCK_TAGS.has(el.tagName);
    if (isBlock) flush();
    for (const child of Array.from(el.childNodes)) walk(child);
    if (isBlock) flush();
  };
  walk(root);
  flush();
  return buf;
}

function cleanTitle(s: string): string {
  return s.replace(/\s+/g, " ").replace(/[\.\-–—:]\s*$/, "").trim().slice(0, 200);
}
