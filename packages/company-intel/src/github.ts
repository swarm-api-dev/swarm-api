import type { DB } from "@swarmapi/db";
import { fetchJsonCached, UpstreamError } from "./cache";

const TTL_REPO_META_MS = 60 * 60 * 1000;
const TTL_REPO_LISTS_MS = 30 * 60 * 1000;
const UA = "SwarmApi info@swarmapi.ai";

export interface GitHubRepoCommit {
  sha: string;
  message: string;
  author: string | null;
  date: string | null;
  url: string;
}

export interface GitHubRepoRelease {
  tag: string;
  name: string | null;
  publishedAt: string | null;
  isPrerelease: boolean;
  url: string;
}

export interface GitHubRepoContributor {
  login: string;
  contributions: number;
  url: string;
}

export interface GitHubRepoSnapshot {
  owner: string;
  repo: string;
  fullName: string;
  description: string | null;
  url: string;
  homepage: string | null;
  stars: number;
  forks: number;
  watchers: number;
  openIssues: number;
  defaultBranch: string;
  primaryLanguage: string | null;
  languages: Record<string, number>;
  topics: string[];
  license: string | null;
  sizeKb: number;
  archived: boolean;
  fork: boolean;
  createdAt: string;
  updatedAt: string;
  pushedAt: string | null;
  recentCommits: GitHubRepoCommit[];
  recentReleases: GitHubRepoRelease[];
  topContributors: GitHubRepoContributor[];
}

interface GitHubRepoRaw {
  full_name?: string;
  description?: string | null;
  html_url?: string;
  homepage?: string | null;
  stargazers_count?: number;
  forks_count?: number;
  subscribers_count?: number;
  open_issues_count?: number;
  default_branch?: string;
  language?: string | null;
  topics?: string[];
  license?: { name?: string } | null;
  size?: number;
  archived?: boolean;
  fork?: boolean;
  created_at?: string;
  updated_at?: string;
  pushed_at?: string | null;
}

interface GitHubCommitRaw {
  sha?: string;
  html_url?: string;
  commit?: {
    message?: string;
    author?: { name?: string; date?: string };
  };
  author?: { login?: string } | null;
}

interface GitHubReleaseRaw {
  tag_name?: string;
  name?: string | null;
  html_url?: string;
  published_at?: string | null;
  prerelease?: boolean;
}

interface GitHubContributorRaw {
  login?: string;
  contributions?: number;
  html_url?: string;
}

export function parseRepoSlug(slug: string): { owner: string; repo: string } {
  const cleaned = slug
    .trim()
    .replace(/^https?:\/\/github\.com\//i, "")
    .replace(/\.git$/i, "")
    .replace(/\/+$/g, "");
  const parts = cleaned.split("/");
  if (parts.length < 2 || !parts[0] || !parts[1]) {
    throw new Error(`Invalid GitHub slug "${slug}". Expected owner/repo.`);
  }
  return { owner: parts[0], repo: parts[1] };
}

export async function fetchRepoSnapshot(
  db: DB,
  slug: string,
  apiKey: string,
): Promise<GitHubRepoSnapshot> {
  const { owner, repo } = parseRepoSlug(slug);
  const headers: Record<string, string> = {
    "User-Agent": UA,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
  const base = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;

  const [repoMeta, languages, commits, releases, contributors] = await Promise.all([
    fetchJsonCached<GitHubRepoRaw>(db, base, TTL_REPO_META_MS, { headers }),
    fetchJsonCached<Record<string, number>>(db, `${base}/languages`, TTL_REPO_META_MS, {
      headers,
    }).catch((err) => {
      if (err instanceof UpstreamError) return {} as Record<string, number>;
      throw err;
    }),
    fetchJsonCached<GitHubCommitRaw[]>(db, `${base}/commits?per_page=10`, TTL_REPO_LISTS_MS, {
      headers,
    }).catch((err) => {
      if (err instanceof UpstreamError) return [] as GitHubCommitRaw[];
      throw err;
    }),
    fetchJsonCached<GitHubReleaseRaw[]>(db, `${base}/releases?per_page=5`, TTL_REPO_LISTS_MS, {
      headers,
    }).catch((err) => {
      if (err instanceof UpstreamError) return [] as GitHubReleaseRaw[];
      throw err;
    }),
    fetchJsonCached<GitHubContributorRaw[]>(
      db,
      `${base}/contributors?per_page=10`,
      TTL_REPO_LISTS_MS,
      { headers },
    ).catch((err) => {
      if (err instanceof UpstreamError) return [] as GitHubContributorRaw[];
      throw err;
    }),
  ]);

  return {
    owner,
    repo,
    fullName: repoMeta.full_name ?? `${owner}/${repo}`,
    description: repoMeta.description ?? null,
    url: repoMeta.html_url ?? `https://github.com/${owner}/${repo}`,
    homepage: repoMeta.homepage ?? null,
    stars: repoMeta.stargazers_count ?? 0,
    forks: repoMeta.forks_count ?? 0,
    watchers: repoMeta.subscribers_count ?? 0,
    openIssues: repoMeta.open_issues_count ?? 0,
    defaultBranch: repoMeta.default_branch ?? "main",
    primaryLanguage: repoMeta.language ?? null,
    languages: languages ?? {},
    topics: repoMeta.topics ?? [],
    license: repoMeta.license?.name ?? null,
    sizeKb: repoMeta.size ?? 0,
    archived: repoMeta.archived ?? false,
    fork: repoMeta.fork ?? false,
    createdAt: repoMeta.created_at ?? "",
    updatedAt: repoMeta.updated_at ?? "",
    pushedAt: repoMeta.pushed_at ?? null,
    recentCommits: (Array.isArray(commits) ? commits : []).map((c) => ({
      sha: (c.sha ?? "").slice(0, 7),
      message: (c.commit?.message ?? "").split("\n")[0]?.slice(0, 200) ?? "",
      author: c.author?.login ?? c.commit?.author?.name ?? null,
      date: c.commit?.author?.date ?? null,
      url: c.html_url ?? "",
    })),
    recentReleases: (Array.isArray(releases) ? releases : []).map((r) => ({
      tag: r.tag_name ?? "",
      name: r.name ?? null,
      publishedAt: r.published_at ?? null,
      isPrerelease: r.prerelease ?? false,
      url: r.html_url ?? "",
    })),
    topContributors: (Array.isArray(contributors) ? contributors : []).map((c) => ({
      login: c.login ?? "",
      contributions: c.contributions ?? 0,
      url: c.html_url ?? "",
    })),
  };
}
