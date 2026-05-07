export { resolveCompany } from "./resolve";
export type { CompanyMatch, ResolveResponse } from "./resolve";

export { listFilings } from "./filings";
export type { FilingRecord, ListFilingsOptions, ListFilingsResponse } from "./filings";

export { extractFiling } from "./extract";
export type {
  ExtractFilingOptions,
  ExtractFilingResponse,
  ExtractedItem,
} from "./extract";

export { UpstreamError } from "./cache";
