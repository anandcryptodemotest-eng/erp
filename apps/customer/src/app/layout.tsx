import type { Metadata, Viewport } from "next";
import type { CSSProperties } from "react";
import { Fraunces, Outfit } from "next/font/google";
import "./globals.css";

const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-display-loaded",
  display: "swap",
});

const body = Outfit({
  subsets: ["latin"],
  variable: "--font-body-loaded",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Trust Wood",
  description: "Order plywood, timber and building materials — track every stage",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Trust Wood" },
};

export const viewport: Viewport = {
  themeColor: "#1e3d32",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const fontVars = {
    ["--font-display" as string]: "var(--font-display-loaded), Georgia, serif",
    ["--font-body" as string]: "var(--font-body-loaded), system-ui, sans-serif",
  } as CSSProperties;

  return (
    <html lang="en" className={`${display.variable} ${body.variable}`} data-scroll-behavior="smooth">
      <body className="min-h-screen antialiased" style={fontVars}>
        {children}
      </body>
    </html>
  );
}
