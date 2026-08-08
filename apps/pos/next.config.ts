import type { NextConfig } from "next";

const GATEWAY_URL = process.env.GATEWAY_SERVICE_URL ?? "http://localhost:3010";

const nextConfig: NextConfig = {
  transpilePackages: ["@erp/ui", "@erp/types"],
  async rewrites() {
    return [
      { source: "/_svc/:path*", destination: `${GATEWAY_URL}/admin/:path*` },
    ];
  },
};

export default nextConfig;
