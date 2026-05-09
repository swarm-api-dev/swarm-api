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

export { listNews } from "./news";
export type { NewsArticle, ListNewsOptions, ListNewsResponse } from "./news";

export { listJobs } from "./jobs";
export type {
  AtsProvider,
  JobPosting,
  ListJobsOptions,
  ListJobsResponse,
} from "./jobs";

export { listInsiderTransactions } from "./insiders";
export type {
  InsiderTransaction,
  ListInsidersOptions,
  ListInsidersResponse,
} from "./insiders";

export { webSearch } from "./search";
export type { SearchResult, WebSearchOptions, WebSearchResponse } from "./search";

export { fetchRepoSnapshot, parseRepoSlug } from "./github";
export type {
  GitHubRepoSnapshot,
  GitHubRepoCommit,
  GitHubRepoRelease,
  GitHubRepoContributor,
} from "./github";

export { fetchPackageInfo } from "./packages";
export type {
  PackageRegistry,
  PackageInfo,
  PackageVulnerability,
  PackageVersionRecord,
} from "./packages";

export { UpstreamError } from "./cache";
