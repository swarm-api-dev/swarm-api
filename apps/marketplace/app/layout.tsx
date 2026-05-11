import type { ReactNode } from "react";
import { MarketplaceFooter } from "./components/MarketplaceFooter";
import { MarketplaceHeader } from "./components/MarketplaceHeader";
import "./globals.css";

export const metadata = {
  title: "SwarmApi Marketplace — Pay-per-call APIs for AI agents",
  description:
    "Browse the live x402 API catalog: SEC filings, news, hiring, GitHub, package CVEs, web search. Pay per call in USDC on Base. No keys, no signups.",
  alternates: {
    canonical: "https://marketplace.swarm-api.com",
  },
  openGraph: {
    title: "SwarmApi Marketplace — Pay-per-call APIs for AI agents",
    description:
      "Nine x402 endpoints. USDC settlement on Base. Drop the MCP server into Claude Desktop and your agent pays per call.",
    type: "website",
    url: "https://marketplace.swarm-api.com",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
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
      <body>
        <MarketplaceHeader />
        {children}
        <MarketplaceFooter />
      </body>
    </html>
  );
}
