import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import "./premium.css";

export const metadata: Metadata = {
  title: "Smart MF Terminal — 2:30 PM Decision Engine",
  description: "Premium Indian mutual fund opportunity dashboard with sector heatmap, correction scoring and long-term portfolio allocation.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
