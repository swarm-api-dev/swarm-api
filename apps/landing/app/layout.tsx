import type { ReactNode } from "react";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const SITE = "https://swarm-api.com";

export const metadata = {
  metadataBase: new URL(SITE),
  title: "SwarmApi — Structured APIs for agents · MCP & SDK · USDC per call (x402)",
  description:
    "SEC, news, jobs, web search, GitHub, and CVE signals as JSON for AI agents. Connect via @swarm-api/mcp (Cursor, Claude, Continue) or @swarm-api/sdk. Pay per successful call in USDC on Base — HTTP 402 x402, no vendor API keys.",
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
    title: "SwarmApi — MCP & HTTP APIs priced per call (USDC · Base · x402)",
    description:
      "Live gateway at api.swarm-api.com: filings, news, hiring, search, repo health, package CVEs. MCP or TypeScript SDK. Wallet-funded micropayments instead of API keys.",
    type: "website",
    url: SITE,
    siteName: "SwarmApi",
  },
  twitter: {
    card: "summary_large_image",
    title: "SwarmApi — Agent APIs via MCP or SDK (x402 · USDC)",
    description:
      "Structured JSON tools for agents: SEC, signals, search, GitHub, CVEs. Per-call USDC on Base. Free MCP probes: gateway_ping, gateway_catalog.",
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
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
