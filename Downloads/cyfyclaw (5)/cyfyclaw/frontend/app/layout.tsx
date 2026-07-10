import type { Metadata } from "next";
import "./globals.css";
// Syntax-highlight colors live in globals.css (.hljs-* rules); no external
// highlight.js theme is imported. Fonts are loaded at runtime via <link> below
// (not next/font) so the production build stays hermetic and works in locked-down
// Docker/CI networks. If the webfont is unavailable, the system stack in
// globals.css is used automatically.

export const metadata: Metadata = {
  title: "CyfyClaw — AI Detection Engineering Platform",
  description:
    "AI Detection Engineering Platform for Enterprise SOCs. Reduce false positives without reducing detection coverage.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
