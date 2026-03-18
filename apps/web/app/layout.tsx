import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nibras",
  description: "Hosted GitHub-linked CLI and dashboard for project workflows."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
