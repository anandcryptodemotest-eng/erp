import type { NextConfig } from "next";

const GATEWAY_URL = process.env.GATEWAY_SERVICE_URL ?? "http://127.0.0.1:3010/admin";

/** Served behind nginx at https://HOST/platform — never publish :3011. */
const nextConfig: NextConfig = {
  basePath: "/platform",
  transpilePackages: ["@erp/ui", "@erp/platform-core", "@erp/process-designer", "@erp/process-forms"],
  allowedDevOrigins: ["150.242.201.102", "localhost", "127.0.0.1"],
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${GATEWAY_URL}/api/:path*` }];
  },
};

export default nextConfig;
