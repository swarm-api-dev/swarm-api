import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "SwarmApi Dashboard — Live x402 payment events",
  description:
    "Real-time payment events recorded by the SwarmApi gateway. Settled USDC volume, success rate, recent payers.",
  alternates: {
    canonical: "https://dashboard.swarm-api.com",
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
      <body>{children}</body>
    </html>
  );
}
