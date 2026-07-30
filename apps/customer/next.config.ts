import type { NextConfig } from "next";

// Browser calls same-origin `/api/*`; Next proxies to the gateway (which rewrites to services).
// Avoids CORS "Failed to fetch" from :3007 → :3010.
// Gateway is behind nginx with basePath /admin; SSR rewrites hit loopback only.
const GATEWAY_URL = process.env.GATEWAY_SERVICE_URL ?? "http://127.0.0.1:3010/admin";

const nextConfig: NextConfig = {
  transpilePackages: ["@erp/ui", "@erp/types", "@erp/ui-runtime", "@erp/workflow", "@erp/extensions"],
  allowedDevOrigins: ["150.242.201.102", "localhost", "127.0.0.1"],
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${GATEWAY_URL}/api/:path*` },
    ];
  },
};

export default nextConfig;
