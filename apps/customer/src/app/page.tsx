import type { Metadata } from "next";
import { MarketingLanding } from "@/components/MarketingLanding";
import "./landing.css";

export const metadata: Metadata = {
  title: "WimFlo — On business. one flow",
  description:
    "Multi-tenant SaaS ERP for growing SMEs. Sales, inventory, purchasing, delivery and a branded customer portal — by Sankalp Platforms.",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "48x48" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export default function LandingPage() {
  return <MarketingLanding />;
}
