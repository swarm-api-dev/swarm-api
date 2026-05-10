import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/" }],
    sitemap: "https://marketplace.swarm-api.com/sitemap.xml",
    host: "https://marketplace.swarm-api.com",
  };
}
