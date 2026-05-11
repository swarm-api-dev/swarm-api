# Vercel (monorepo)

Each Next.js app is a **separate Vercel project** (`swarm-api.com`, `marketplace.*`, `dashboard.*`).

## Required settings (each project)

1. **Root Directory** — set to exactly one of:
   - `apps/landing`
   - `apps/marketplace`
   - `apps/dashboard`  

   If Root Directory is left as **`.`** (repo root), Vercel will **not** read `apps/*/vercel.json` and will run the root `package.json` `build` script instead — that builds the gateway/SDK, **not** Next.js, and you get **“.next was not found”**.

2. **Output Directory** — leave **empty**. Do not set `.next` manually for Next.js.

3. **Framework preset** — Next.js (auto-detected).

The `vercel.json` in each app installs from the monorepo root when needed (`npm ci --prefix ../..`) and runs `npm run build` in that app so `.next` is created next to `next.config.mjs`.

## CLI deploy

From the app folder (after `vercel link`):

```bash
cd apps/landing   # or marketplace / dashboard
npx vercel deploy --prod --yes
```

Or link once per project at the repo root *only if* the cloud project’s Root Directory already matches that app (see above).
