import type { DB } from "@swarmapi/db";
import { fetchJsonCached, UpstreamError } from "./cache";

const TTL_PKG_MS = 60 * 60 * 1000;
const TTL_OSV_MS = 6 * 60 * 60 * 1000;
const TTL_DOWNLOADS_MS = 24 * 60 * 60 * 1000;
const UA = "SwarmApi info@swarm-api.com";

export type PackageRegistry = "npm" | "pypi" | "cargo";

export interface PackageVulnerability {
  id: string;
  summary: string;
  severity: string | null;
  fixedIn: string | null;
  references: string[];
}

export interface PackageVersionRecord {
  version: string;
  publishedAt: string | null;
}

export interface PackageInfo {
  registry: PackageRegistry;
  name: string;
  latestVersion: string | null;
  description: string | null;
  homepage: string | null;
  repository: string | null;
  license: string | null;
  authors: string[];
  keywords: string[];
  publishedAt: string | null;
  weeklyDownloads: number | null;
  dependencies: Record<string, string>;
  recentVersions: PackageVersionRecord[];
  deprecated: string | null;
  vulnerabilities: PackageVulnerability[];
}

export async function fetchPackageInfo(
  db: DB,
  registry: PackageRegistry,
  name: string,
): Promise<PackageInfo> {
  switch (registry) {
    case "npm":
      return fetchNpm(db, name);
    case "pypi":
      return fetchPyPI(db, name);
    case "cargo":
      return fetchCargo(db, name);
  }
}

interface NpmPackage {
  name?: string;
  description?: string;
  homepage?: string;
  license?: string | { type?: string };
  keywords?: string[];
  author?: string | { name?: string };
  maintainers?: Array<{ name?: string }>;
  repository?: { url?: string } | string;
  "dist-tags"?: { latest?: string };
  versions?: Record<
    string,
    { dependencies?: Record<string, string>; deprecated?: string }
  >;
  time?: Record<string, string>;
}

async function fetchNpm(db: DB, name: string): Promise<PackageInfo> {
  const url = `https://registry.npmjs.org/${encodeURIComponent(name)}`;
  const data = await fetchJsonCached<NpmPackage>(db, url, TTL_PKG_MS, {
    headers: { "User-Agent": UA, Accept: "application/json" },
  });
  const latest = data["dist-tags"]?.latest ?? null;
  const versionInfo = latest && data.versions ? data.versions[latest] : undefined;
  const time = data.time ?? {};
  const recentVersions = Object.keys(time)
    .filter((k) => k !== "modified" && k !== "created")
    .map((v) => ({ version: v, publishedAt: time[v] ?? null }))
    .sort((a, b) => (a.publishedAt ?? "") < (b.publishedAt ?? "") ? 1 : -1)
    .slice(0, 10);

  let weeklyDownloads: number | null = null;
  try {
    const dl = await fetchJsonCached<{ downloads?: number }>(
      db,
      `https://api.npmjs.org/downloads/point/last-week/${encodeURIComponent(name)}`,
      TTL_DOWNLOADS_MS,
      { headers: { "User-Agent": UA } },
    );
    weeklyDownloads = dl.downloads ?? null;
  } catch {
    // npm downloads service occasionally 502s; non-fatal
  }

  const repoUrl =
    typeof data.repository === "string"
      ? data.repository
      : data.repository?.url ?? null;
  const license =
    typeof data.license === "string" ? data.license : data.license?.type ?? null;
  const authors: string[] = [];
  if (typeof data.author === "string") authors.push(data.author);
  else if (data.author?.name) authors.push(data.author.name);
  for (const m of data.maintainers ?? []) {
    if (m.name && !authors.includes(m.name)) authors.push(m.name);
  }

  const vulnerabilities = await fetchOsvVulns(db, "npm", name, latest ?? undefined);

  return {
    registry: "npm",
    name: data.name ?? name,
    latestVersion: latest,
    description: data.description ?? null,
    homepage: data.homepage ?? null,
    repository: cleanRepoUrl(repoUrl),
    license,
    authors,
    keywords: data.keywords ?? [],
    publishedAt: latest ? time[latest] ?? null : null,
    weeklyDownloads,
    dependencies: versionInfo?.dependencies ?? {},
    recentVersions,
    deprecated: versionInfo?.deprecated ?? null,
    vulnerabilities,
  };
}

interface PyPIPackage {
  info?: {
    name?: string;
    version?: string;
    summary?: string;
    home_page?: string;
    project_urls?: Record<string, string>;
    license?: string;
    keywords?: string;
    author?: string;
    maintainer?: string;
    requires_dist?: string[] | null;
    yanked?: boolean;
    yanked_reason?: string | null;
  };
  releases?: Record<string, Array<{ upload_time?: string }>>;
}

async function fetchPyPI(db: DB, name: string): Promise<PackageInfo> {
  const url = `https://pypi.org/pypi/${encodeURIComponent(name)}/json`;
  const data = await fetchJsonCached<PyPIPackage>(db, url, TTL_PKG_MS, {
    headers: { "User-Agent": UA, Accept: "application/json" },
  });
  const info = data.info ?? {};
  const latest = info.version ?? null;
  const releases = data.releases ?? {};

  const recentVersions: PackageVersionRecord[] = Object.entries(releases)
    .map(([version, files]) => ({
      version,
      publishedAt: files?.[0]?.upload_time ?? null,
    }))
    .sort((a, b) => ((a.publishedAt ?? "") < (b.publishedAt ?? "") ? 1 : -1))
    .slice(0, 10);

  const dependencies: Record<string, string> = {};
  for (const dep of info.requires_dist ?? []) {
    const m = /^([a-zA-Z0-9_.\-]+)\s*([^;]+)?/.exec(dep);
    if (m && m[1]) dependencies[m[1]] = (m[2] ?? "").trim();
  }

  const homepage =
    info.home_page ?? info.project_urls?.Homepage ?? info.project_urls?.["Home-page"] ?? null;
  const repository =
    info.project_urls?.Repository ??
    info.project_urls?.Source ??
    info.project_urls?.["Source Code"] ??
    null;

  const authors: string[] = [];
  if (info.author) authors.push(info.author);
  if (info.maintainer && !authors.includes(info.maintainer)) authors.push(info.maintainer);

  const vulnerabilities = await fetchOsvVulns(db, "PyPI", name, latest ?? undefined);

  return {
    registry: "pypi",
    name: info.name ?? name,
    latestVersion: latest,
    description: info.summary ?? null,
    homepage,
    repository: cleanRepoUrl(repository ?? null),
    license: info.license ?? null,
    authors,
    keywords: (info.keywords ?? "").split(/[,\s]+/).filter(Boolean),
    publishedAt: recentVersions[0]?.publishedAt ?? null,
    weeklyDownloads: null,
    dependencies,
    recentVersions,
    deprecated: info.yanked ? info.yanked_reason ?? "yanked" : null,
    vulnerabilities,
  };
}

interface CargoCrate {
  crate?: {
    id?: string;
    name?: string;
    description?: string;
    homepage?: string | null;
    repository?: string | null;
    documentation?: string | null;
    keywords?: string[];
    newest_version?: string;
    max_version?: string;
    downloads?: number;
    recent_downloads?: number;
    created_at?: string;
    updated_at?: string;
  };
  versions?: Array<{
    num?: string;
    license?: string | null;
    yanked?: boolean;
    created_at?: string;
    published_by?: { login?: string } | null;
  }>;
}

async function fetchCargo(db: DB, name: string): Promise<PackageInfo> {
  const url = `https://crates.io/api/v1/crates/${encodeURIComponent(name)}`;
  const data = await fetchJsonCached<CargoCrate>(db, url, TTL_PKG_MS, {
    headers: { "User-Agent": UA, Accept: "application/json" },
  });
  const crate = data.crate ?? {};
  const versions = data.versions ?? [];
  const latestVer = versions[0];
  const latest = crate.newest_version ?? latestVer?.num ?? null;

  const recentVersions: PackageVersionRecord[] = versions.slice(0, 10).map((v) => ({
    version: v.num ?? "",
    publishedAt: v.created_at ?? null,
  }));

  const authors: string[] = [];
  for (const v of versions.slice(0, 3)) {
    const login = v.published_by?.login;
    if (login && !authors.includes(login)) authors.push(login);
  }

  const yanked = versions.find((v) => v.num === latest)?.yanked;
  const vulnerabilities = await fetchOsvVulns(db, "crates.io", name, latest ?? undefined);

  return {
    registry: "cargo",
    name: crate.name ?? name,
    latestVersion: latest,
    description: crate.description ?? null,
    homepage: crate.homepage ?? null,
    repository: cleanRepoUrl(crate.repository ?? null),
    license: latestVer?.license ?? null,
    authors,
    keywords: crate.keywords ?? [],
    publishedAt: latestVer?.created_at ?? crate.updated_at ?? null,
    weeklyDownloads:
      typeof crate.recent_downloads === "number"
        ? Math.round(crate.recent_downloads / 13)
        : null,
    dependencies: {},
    recentVersions,
    deprecated: yanked ? "yanked" : null,
    vulnerabilities,
  };
}

interface OsvResponse {
  vulns?: Array<{
    id?: string;
    summary?: string;
    details?: string;
    severity?: Array<{ type?: string; score?: string }>;
    affected?: Array<{
      ranges?: Array<{
        events?: Array<{ introduced?: string; fixed?: string }>;
      }>;
    }>;
    references?: Array<{ url?: string }>;
  }>;
}

async function fetchOsvVulns(
  db: DB,
  ecosystem: "npm" | "PyPI" | "crates.io",
  name: string,
  version?: string,
): Promise<PackageVulnerability[]> {
  if (!version) return [];
  const cacheKey = `osv:${ecosystem}:${name}@${version}`;
  // We don't have a generic post-cached helper; piggyback fetchJsonCached using a synthetic GET URL.
  // OSV is POST so we issue manually but cache the result via a synthetic key approach: fetch, then write cache row directly.
  try {
    const res = await fetch("https://api.osv.dev/v1/query", {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": UA },
      body: JSON.stringify({
        version,
        package: { name, ecosystem },
      }),
    });
    if (!res.ok) {
      throw new UpstreamError(`OSV ${res.status} ${res.statusText}`, res.status);
    }
    const data = (await res.json()) as OsvResponse;
    return (data.vulns ?? []).map((v) => {
      let fixedIn: string | null = null;
      for (const aff of v.affected ?? []) {
        for (const range of aff.ranges ?? []) {
          for (const ev of range.events ?? []) {
            if (ev.fixed) {
              fixedIn = ev.fixed;
              break;
            }
          }
          if (fixedIn) break;
        }
        if (fixedIn) break;
      }
      const sev = v.severity?.[0];
      return {
        id: v.id ?? "",
        summary: v.summary ?? v.details?.slice(0, 200) ?? "",
        severity: sev?.score ?? sev?.type ?? null,
        fixedIn,
        references: (v.references ?? []).map((r) => r.url ?? "").filter(Boolean).slice(0, 5),
      };
    });
  } catch (err) {
    // OSV is a value-add — never fail the whole request because OSV is down
    if (err instanceof UpstreamError) return [];
    return [];
  }
}

function cleanRepoUrl(raw: string | null): string | null {
  if (!raw) return null;
  return raw
    .replace(/^git\+/, "")
    .replace(/^git:\/\//, "https://")
    .replace(/\.git$/, "");
}
