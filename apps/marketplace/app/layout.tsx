import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "AgentPay marketplace",
  description: "x402-monetized APIs for AI agents",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
