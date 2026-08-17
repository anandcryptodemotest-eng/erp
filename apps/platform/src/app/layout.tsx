import type { Metadata, Viewport } from "next";
import type { CSSProperties, ReactNode } from "react";
import { Unbounded, Space_Grotesk } from "next/font/google";
import { ToastProvider } from "@erp/ui";
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

export const metadata: Metadata = {
  title: "WimFlo Platform",
  description: "WimFlo — platform operations",
};

export const viewport: Viewport = {
  themeColor: "#06040f",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const fontVars = {
    ["--font-display" as string]: "var(--font-display-loaded), system-ui, sans-serif",
    ["--font-body" as string]: "var(--font-body-loaded), system-ui, sans-serif",
  } as CSSProperties;

  return (
    <html
      lang="en"
      className={`${display.variable} ${body.variable}`}
      data-theme="wimflo"
      data-density="dense"
    >
      <body className="min-h-screen antialiased erp-canvas" style={fontVars}>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
