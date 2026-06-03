import type { NextConfig } from "next";

const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL ?? "http://localhost:3010";
const SALES_URL = process.env.NEXT_PUBLIC_SALES_URL ?? "http://localhost:3001";
const INVENTORY_URL = process.env.NEXT_PUBLIC_INVENTORY_URL ?? "http://localhost:3002";
const ACCOUNTING_URL = process.env.NEXT_PUBLIC_ACCOUNTING_URL ?? "http://localhost:3003";

const nextConfig: NextConfig = {
  transpilePackages: ["@erp/ui", "@erp/types"],
  async rewrites() {
    return [
      { source: "/_svc/gateway/:path*", destination: `${GATEWAY_URL}/:path*` },
      { source: "/_svc/sales/:path*", destination: `${SALES_URL}/:path*` },
      { source: "/_svc/inventory/:path*", destination: `${INVENTORY_URL}/:path*` },
      { source: "/_svc/accounting/:path*", destination: `${ACCOUNTING_URL}/:path*` },
    ];
  },
};

export default nextConfig;
