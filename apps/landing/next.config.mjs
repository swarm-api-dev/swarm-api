import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Monorepo root (has packages/apps lockfile). Silence stray-user-folder lockfile warning on Windows. */
const tracingRoot = path.resolve(__dirname, "..", "..");

/** @type {import("next").NextConfig} */
const nextConfig = {
  outputFileTracingRoot: tracingRoot,
};

export default nextConfig;
