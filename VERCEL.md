# Vercel (monorepo)

Each Next.js app is a **separate Vercel project** (`swarm-api.com`, `marketplace.*`, `dashboard.*`).

## Root Directory (required)

| Vercel project         | Root Directory must be |
|------------------------|-------------------------|
| `swarmapi-landing`     | `apps/landing`          |
| `swarmapi-marketplace` | `apps/marketplace`      |
| `swarmapi-dashboard`   | `apps/dashboard`        |

**Current checks (`vercel project inspect`):** landing must **not** use `.` — if it does, Vercel runs the repo-root `build` (gateway/SDK) instead of Next.js → **“.next was not found at /vercel/path0/.next”**.

Fix in the dashboard: **Project → Settings → General → Root Directory**.

### Fix landing via API (optional)

```bash
export VERCEL_TOKEN="..."   # Account → Settings → Tokens

curl -X PATCH "https://api.vercel.com/v9/projects/prj_GqVRCj4IkudVBY9eIFffoiYSKmLm" \
  -H "Authorization: Bearer $VERCEL_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"rootDirectory":"apps/landing"}'
```

(Replace project ID after inspecting `swarmapi-landing`.)

## Node.js

Set **Node.js 22.x** under **Project → Settings → General** to align with root `package.json` `"engines": { "node": "22.x" }`.

## Output Directory

Leave **empty** (Next.js default). Do not point it at `.next` manually.

## `vercel.json` (per app)

`installCommand` runs `npm ci` at the repo root when the app folder has no lockfile (`npm ci --prefix ../..`), then `npm run build` runs in that app.

## CLI deploy

Use the **repository root** (`x402/`), not `cd apps/marketplace`, when the Vercel **Root Directory** is already `apps/marketplace` or `apps/dashboard`. Otherwise the CLI doubles the path (`apps/marketplace/apps/marketplace`).

```bash
cd /path/to/x402
npx vercel link --yes --project swarmapi-marketplace   # or swarmapi-dashboard / swarmapi-landing
npx vercel deploy --prod --yes
```

After **`swarmapi-landing`** Root Directory is fixed to `apps/landing`, use the same pattern from the repo root.
