import type { NextConfig } from "next";

// Browser calls same-origin `/api/*`; Next proxies to the gateway (which rewrites to services).
// Avoids CORS "Failed to fetch" from :3007 → :3010.
const GATEWAY_URL = process.env.GATEWAY_SERVICE_URL ?? "http://localhost:3010";

const nextConfig: NextConfig = {
  transpilePackages: ["@erp/ui", "@erp/types"],
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${GATEWAY_URL}/api/:path*` },
    ];
  },
};

export default nextConfig;
