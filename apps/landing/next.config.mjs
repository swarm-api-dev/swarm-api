import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import("next").NextConfig} */
const nextConfig = {};

// Local monorepo (e.g. stray lockfile outside repo): pin tracing to workspace root.
// On Vercel the deployment bundle is only `apps/landing`; pointing outside breaks finalize
// (ENOENT … /vercel/path0/vercel/path0/.next/routes-manifest.json).
if (!process.env.VERCEL) {
  nextConfig.outputFileTracingRoot = path.resolve(__dirname, "..", "..");
}

export default nextConfig;
