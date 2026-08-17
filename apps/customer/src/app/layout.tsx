import type { Metadata, Viewport } from "next";
import type { CSSProperties } from "react";
import { Unbounded, Space_Grotesk } from "next/font/google";
import { PwaRegister } from "@/components/PwaRegister";
import { TenantBrandingProvider } from "@/components/TenantBrandingProvider";
import "./globals.css";

const display = Unbounded({
  subsets: ["latin"],
  variable: "--font-display-loaded",
  display: "swap",
});

const body = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-body-loaded",
  display: "swap",
});

const titleFallback =
  process.env.NEXT_PUBLIC_TENANT_NAME?.trim() || "WimFlo";

export const metadata: Metadata = {
  title: titleFallback,
  description: "On business. one flow — order, configure, and track every stage",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: titleFallback },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "48x48" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#06040f",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const fontVars = {
    ["--font-display" as string]: "var(--font-display-loaded), system-ui, sans-serif",
    ["--font-body" as string]: "var(--font-body-loaded), system-ui, sans-serif",
  } as CSSProperties;

  return (
    <html
      lang="en"
      className={`${display.variable} ${body.variable}`}
      data-scroll-behavior="smooth"
      data-theme="wimflo"
      data-density="comfortable"
    >
      <body className="erp-canvas min-h-screen antialiased" style={fontVars}>
        <TenantBrandingProvider>{children}</TenantBrandingProvider>
        <PwaRegister />
      </body>
    </html>
  );
}
