import type { ReactNode } from "react";
import { DashboardFooter } from "./components/DashboardFooter";
import { DashboardHeader } from "./components/DashboardHeader";
import "./globals.css";

const SITE = "https://dashboard.swarm-api.com";

export const metadata = {
  metadataBase: new URL(SITE),
  title: "SwarmApi Dashboard — Live x402 payment events",
  description:
    "Real-time payment events recorded by the SwarmApi gateway. Settled USDC volume, success rate, recent payers.",
  alternates: {
    canonical: SITE,
  },
  openGraph: {
    title: "SwarmApi Dashboard — Live x402 payment events",
    description:
      "Gateway stats and recent USDC settlements on Base. Monitor payer volume and failed attempts.",
    type: "website",
    url: SITE,
  },
  robots: {
    index: true,
    follow: true,
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
        <DashboardHeader />
        {children}
        <DashboardFooter />
      </body>
    </html>
  );
}
