import type { Metadata } from "next";
import { ToastProvider } from "@erp/ui";
import "./globals.css";

export const metadata: Metadata = {
  title: "ERP Gateway",
  description: "Enterprise Resource Planning - API Gateway & Portal",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 antialiased">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
