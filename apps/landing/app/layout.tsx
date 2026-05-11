import type { ReactNode } from "react";
import "./globals.css";

const SITE = "https://swarm-api.com";

export const metadata = {
  metadataBase: new URL(SITE),
  title: "SwarmApi — The API marketplace your AI agent can buy from on its own",
  description:
    "Nine production endpoints — SEC filings, news, hiring, web search, GitHub, package CVEs — settled per HTTP call in USDC on Base over the x402 protocol. No API keys, no contracts.",
  keywords: [
    "x402",
    "x402 protocol",
    "MCP server",
    "Model Context Protocol",
    "AI agent API",
    "agentic commerce",
    "USDC API",
    "pay per call API",
    "Base mainnet",
    "Coinbase x402",
    "agent payments",
    "SEC filings API",
    "EDGAR API",
    "Claude Desktop MCP",
    "Cursor MCP",
    "EIP-3009",
  ],
  alternates: {
    canonical: SITE,
  },
  openGraph: {
    title: "SwarmApi — Pay-per-call commerce for AI agents",
    description:
      "Drop the MCP server into Claude Desktop, fund a Base wallet, and your agent pays per call in USDC. Built on x402, the protocol Coinbase shipped in 2025.",
    type: "website",
    url: SITE,
    siteName: "SwarmApi",
  },
  twitter: {
    card: "summary_large_image",
    title: "SwarmApi — Pay-per-call commerce for AI agents",
    description:
      "Nine x402 endpoints, USDC on Base, no subscriptions. The API marketplace your agent can buy from on its own.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-snippet": -1,
      "max-image-preview": "large",
      "max-video-preview": -1,
    },
  },
  other: {
    "ai-content-declaration": "human-authored",
    "x402-gateway": "https://api.swarm-api.com",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0b0d10",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="alternate" type="text/plain" title="LLM-friendly summary" href="/llms.txt" />
        <link rel="alternate" type="application/json" title="AI plugin manifest" href="/.well-known/ai-plugin.json" />
        <link rel="me" href="https://github.com/swarm-api-dev/swarm-api" />
      </head>
      <body>{children}</body>
    </html>
  );
}
