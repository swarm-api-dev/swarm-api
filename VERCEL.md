# Vercel (monorepo)

Use **one Vercel project per app**. For each project:

1. **Git repo**: this repository.
2. **Root Directory**: either **`.`** (repository root) **or** `apps/landing`, `apps/marketplace`, or `apps/dashboard`.  
   The `vercel.json` inside each app folder is only picked up when **Root Directory** points at that app (e.g. `apps/landing`). If Root Directory is `.`, add **Build / Install overrides** in the Vercel dashboard to match that app’s `vercel.json`, or set Root Directory to the matching `apps/*` path (recommended).
3. **Output Directory**: leave **empty** (Next.js default — do not set `.next` manually).

Install and build commands in each `apps/*/vercel.json` always resolve the monorepo root with `git rev-parse` so `.next` is produced under the correct Next app.
