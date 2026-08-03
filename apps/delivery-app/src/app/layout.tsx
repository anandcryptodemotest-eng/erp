import type { Metadata, Viewport } from "next";
import { Outfit } from "next/font/google";
import type { CSSProperties } from "react";
import "./globals.css";

const body = Outfit({
  subsets: ["latin"],
  variable: "--font-body-loaded",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Trust Wood — Delivery",
  description: "Delivery executive app",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Delivery" },
};

export const viewport: Viewport = {
  themeColor: "#ea580c",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const fontVars = {
    ["--font-body" as string]: "var(--font-body-loaded), system-ui, sans-serif",
    ["--font-display" as string]: "var(--font-body-loaded), system-ui, sans-serif",
  } as CSSProperties;

  return (
    <html lang="en" className={body.variable} data-theme="delivery" data-density="compact-touch">
      <body className="min-h-screen antialiased" style={fontVars}>
        {children}
      </body>
    </html>
  );
}
