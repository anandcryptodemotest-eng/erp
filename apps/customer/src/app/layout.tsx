import type { Metadata, Viewport } from "next";
import type { CSSProperties } from "react";
import { Fraunces, Outfit } from "next/font/google";
import { PwaRegister } from "@/components/PwaRegister";
import { TenantBrandingProvider } from "@/components/TenantBrandingProvider";
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

const titleFallback =
  process.env.NEXT_PUBLIC_TENANT_NAME?.trim() || "Customer Portal";

export const metadata: Metadata = {
  title: titleFallback,
  description: "Order materials — track every stage",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, statusBarStyle: "default", title: titleFallback },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#0B5E3C",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const fontVars = {
    ["--font-display" as string]: "var(--font-display-loaded), Georgia, serif",
    ["--font-body" as string]: "var(--font-body-loaded), system-ui, sans-serif",
  } as CSSProperties;

  return (
    <html
      lang="en"
      className={`${display.variable} ${body.variable}`}
      data-scroll-behavior="smooth"
      data-theme="trustwood"
      data-density="comfortable"
    >
      <body className="erp-canvas min-h-screen antialiased" style={fontVars}>
        <TenantBrandingProvider>{children}</TenantBrandingProvider>
        <PwaRegister />
      </body>
    </html>
  );
}
