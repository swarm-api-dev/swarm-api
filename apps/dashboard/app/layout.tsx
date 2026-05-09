import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "SwarmApi dashboard",
  description: "x402 payment events",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
