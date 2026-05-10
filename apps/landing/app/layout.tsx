import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "SwarmApi — The API marketplace your AI agent can buy from on its own",
  description:
    "Nine production endpoints — SEC filings, news, hiring, web search, GitHub, package CVEs — settled per HTTP call in USDC on Base over the x402 protocol. No API keys, no contracts.",
  openGraph: {
    title: "SwarmApi — Pay-per-call commerce for AI agents",
    description:
      "Drop the MCP server into Claude Desktop, fund a Base wallet, and your agent pays per call in USDC. Built on x402, the protocol Coinbase shipped in 2025.",
    type: "website",
    url: "https://swarm-api.com",
  },
  twitter: {
    card: "summary_large_image",
    title: "SwarmApi — Pay-per-call commerce for AI agents",
    description:
      "Nine x402 endpoints, USDC on Base, no subscriptions. The API marketplace your agent can buy from on its own.",
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
      <body>{children}</body>
    </html>
  );
}
