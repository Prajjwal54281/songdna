import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Song DNA",
  description: "Structured genre, mood, and instrumentation analysis for independent musicians.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
