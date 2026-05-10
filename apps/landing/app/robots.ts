import type { MetadataRoute } from "next";

const SITE = "https://swarm-api.com";

/**
 * AI / agent crawlers we want to explicitly welcome. The list mirrors the major
 * commercial crawlers as of mid-2026; the catch-all `*` agent stays open too.
 * We do NOT block any AI training crawlers — the whole product exists to be
 * found and used by agents.
 */
const AI_AGENTS = [
  "GPTBot",
  "ChatGPT-User",
  "OAI-SearchBot",
  "ClaudeBot",
  "Claude-Web",
  "Claude-SearchBot",
  "anthropic-ai",
  "PerplexityBot",
  "Perplexity-User",
  "Google-Extended",
  "GoogleOther",
  "Bingbot",
  "Applebot",
  "Applebot-Extended",
  "Bytespider",
  "DuckAssistBot",
  "Meta-ExternalAgent",
  "Amazonbot",
  "cohere-ai",
  "YouBot",
  "Diffbot",
  "FacebookBot",
  "Timpibot",
  "ImagesiftBot",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      ...AI_AGENTS.map((userAgent) => ({
        userAgent,
        allow: "/",
      })),
      {
        userAgent: "*",
        allow: "/",
      },
    ],
    sitemap: [
      `${SITE}/sitemap.xml`,
      "https://marketplace.swarm-api.com/sitemap.xml",
      "https://dashboard.swarm-api.com/sitemap.xml",
    ],
    host: SITE,
  };
}
