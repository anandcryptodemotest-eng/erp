import type { Metadata, Viewport } from "next";
import type { CSSProperties, ReactNode } from "react";
import { Fraunces, Outfit } from "next/font/google";
import { ToastProvider } from "@erp/ui";
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
  title: "TrustWood Platform",
  description: "TrustWood ERP — platform operations",
};

export const viewport: Viewport = {
  themeColor: "#1e3d32",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const fontVars = {
    ["--font-display" as string]: "var(--font-display-loaded), Georgia, serif",
    ["--font-body" as string]: "var(--font-body-loaded), system-ui, sans-serif",
  } as CSSProperties;

  return (
    <html
      lang="en"
      className={`${display.variable} ${body.variable}`}
      data-theme="trustwood"
      data-density="dense"
    >
      <body className="min-h-screen antialiased erp-canvas" style={fontVars}>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
