import type { DB } from "@agentpay/db";
import { fetchJsonCached, UpstreamError } from "./cache";

const TTL_JOBS_MS = 60 * 60 * 1000;

export type AtsProvider = "greenhouse" | "lever";

export interface JobPosting {
  id: string;
  title: string;
  url: string;
  location: string | null;
  department: string | null;
  postedAt: string | null;
  source: AtsProvider;
}

export interface ListJobsResponse {
  company: string;
  source: AtsProvider | null;
  slug: string | null;
  count: number;
  jobs: JobPosting[];
  notes: string[];
}

export interface ListJobsOptions {
  limit?: number;
  ats?: AtsProvider;
  slug?: string;
}

const KNOWN_ATS: Record<string, { ats: AtsProvider; slug: string }> = {
  anthropic: { ats: "greenhouse", slug: "anthropic" },
  openai: { ats: "greenhouse", slug: "openai" },
  vercel: { ats: "greenhouse", slug: "vercel" },
  notion: { ats: "greenhouse", slug: "notion" },
  ramp: { ats: "greenhouse", slug: "ramp" },
  brex: { ats: "greenhouse", slug: "brex" },
  retool: { ats: "greenhouse", slug: "retool" },
  replit: { ats: "greenhouse", slug: "replit" },
  linear: { ats: "greenhouse", slug: "linear" },
  figma: { ats: "greenhouse", slug: "figma" },
  stripe: { ats: "lever", slug: "stripe" },
  netlify: { ats: "lever", slug: "netlify" },
};

interface GreenhouseJob {
  id?: number | string;
  title?: string;
  absolute_url?: string;
  location?: { name?: string };
  departments?: Array<{ name?: string }>;
  updated_at?: string;
}

interface GreenhouseResponse {
  jobs?: GreenhouseJob[];
}

interface LeverJob {
  id?: string;
  text?: string;
  hostedUrl?: string;
  applyUrl?: string;
  categories?: { team?: string; location?: string; department?: string; commitment?: string };
  createdAt?: number;
}

export async function listJobs(
  db: DB,
  company: string,
  opts: ListJobsOptions = {},
): Promise<ListJobsResponse> {
  const limit = Math.max(1, Math.min(opts.limit ?? 25, 100));
  const notes: string[] = [];

  let ats: AtsProvider | null = opts.ats ?? null;
  let slug: string | null = opts.slug ?? null;

  if (!ats || !slug) {
    const norm = company.toLowerCase().replace(/[^a-z0-9]+/g, "");
    const known = KNOWN_ATS[norm];
    if (known) {
      ats = known.ats;
      slug = known.slug;
      notes.push(`Resolved via known map: ${ats}/${slug}`);
    } else {
      slug = norm;
      notes.push(`Auto-discovery from slug "${slug}": Greenhouse first, then Lever`);
      const gh = await tryGreenhouse(db, slug);
      if (gh) {
        return finalize(company, "greenhouse", slug, gh.slice(0, limit), notes);
      }
      const lv = await tryLever(db, slug);
      if (lv) {
        return finalize(company, "lever", slug, lv.slice(0, limit), notes);
      }
      notes.push(`No board found for slug "${slug}" on Greenhouse or Lever.`);
      return finalize(company, null, null, [], notes);
    }
  }

  if (ats === "greenhouse") {
    const jobs = (await tryGreenhouse(db, slug)) ?? [];
    return finalize(company, "greenhouse", slug, jobs.slice(0, limit), notes);
  }
  const jobs = (await tryLever(db, slug)) ?? [];
  return finalize(company, "lever", slug, jobs.slice(0, limit), notes);
}

async function tryGreenhouse(db: DB, slug: string): Promise<JobPosting[] | null> {
  const url = `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(slug)}/jobs`;
  try {
    const data = await fetchJsonCached<GreenhouseResponse>(db, url, TTL_JOBS_MS);
    return (data.jobs ?? []).map((j) => ({
      id: String(j.id ?? ""),
      title: (j.title ?? "").trim(),
      url: j.absolute_url ?? "",
      location: j.location?.name ?? null,
      department: j.departments?.[0]?.name ?? null,
      postedAt: j.updated_at ?? null,
      source: "greenhouse" as const,
    }));
  } catch (err) {
    if (err instanceof UpstreamError && err.status === 404) return null;
    throw err;
  }
}

async function tryLever(db: DB, slug: string): Promise<JobPosting[] | null> {
  const url = `https://api.lever.co/v0/postings/${encodeURIComponent(slug)}?mode=json`;
  try {
    const data = await fetchJsonCached<LeverJob[]>(db, url, TTL_JOBS_MS);
    return (Array.isArray(data) ? data : []).map((j) => ({
      id: String(j.id ?? ""),
      title: (j.text ?? "").trim(),
      url: j.hostedUrl ?? j.applyUrl ?? "",
      location: j.categories?.location ?? null,
      department: j.categories?.team ?? j.categories?.department ?? null,
      postedAt: j.createdAt ? new Date(j.createdAt).toISOString() : null,
      source: "lever" as const,
    }));
  } catch (err) {
    if (err instanceof UpstreamError && err.status === 404) return null;
    throw err;
  }
}

function finalize(
  company: string,
  source: AtsProvider | null,
  slug: string | null,
  jobs: JobPosting[],
  notes: string[],
): ListJobsResponse {
  return { company, source, slug, count: jobs.length, jobs, notes };
}
