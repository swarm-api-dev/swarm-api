import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import("next").NextConfig} */
const nextConfig = {};

if (!process.env.VERCEL) {
  nextConfig.outputFileTracingRoot = path.resolve(__dirname, "..", "..");
}

export default nextConfig;
