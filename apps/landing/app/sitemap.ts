import type { MetadataRoute } from "next";

const SITE = "https://swarm-api.com";
const NOW = new Date();

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: SITE,
      lastModified: NOW,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${SITE}/#install`,
      lastModified: NOW,
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: `${SITE}/status`,
      lastModified: NOW,
      changeFrequency: "always",
      priority: 0.5,
    },
    {
      url: "https://marketplace.swarm-api.com",
      lastModified: NOW,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: "https://dashboard.swarm-api.com",
      lastModified: NOW,
      changeFrequency: "hourly",
      priority: 0.7,
    },
    {
      url: "https://api.swarm-api.com/v1/endpoints",
      lastModified: NOW,
      changeFrequency: "daily",
      priority: 0.6,
    },
  ];
}
