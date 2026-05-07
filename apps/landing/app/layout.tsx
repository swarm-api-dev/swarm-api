import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "AgentPay — Monetize your API for AI agents",
  description: "x402 payment gating, instant USDC settlement, no API keys.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
