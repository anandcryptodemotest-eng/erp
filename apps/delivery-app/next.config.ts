import type { NextConfig } from "next";

const GATEWAY_URL = process.env.GATEWAY_SERVICE_URL ?? "http://localhost:3010";

const nextConfig: NextConfig = {
  transpilePackages: ["@erp/types", "@erp/ui"],
  async rewrites() {
    return [
      { source: "/api/auth/:path*", destination: `${GATEWAY_URL}/admin/api/auth/:path*` },
      { source: "/api/auth", destination: `${GATEWAY_URL}/admin/api/auth` },
      { source: "/api/delivery/:path*", destination: `${GATEWAY_URL}/admin/:path*` },
    ];
  },
};

export default nextConfig;
