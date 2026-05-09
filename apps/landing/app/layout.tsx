import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "SwarmApi — Company intelligence for AI agents",
  description:
    "SEC filings, news, and hiring signals as structured JSON. Pay per HTTP call in USDC over x402.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
