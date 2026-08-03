import type { NextConfig } from "next";
import path from "path";

const GATEWAY_URL = process.env.GATEWAY_SERVICE_URL ?? "http://127.0.0.1:3010/admin";
const monorepoRoot = path.join(__dirname, "../..");

/** Served behind nginx at https://HOST/platform — never publish :3011. */
const nextConfig: NextConfig = {
  basePath: "/platform",
  // Turbopack project root must be the monorepo so packages/* resolve for workspace imports.
  turbopack: {
    root: monorepoRoot,
    resolveAlias: {
      "@erp/ui": "./packages/ui/src/index.ts",
      "@erp/workflow": "./packages/workflow/src/index.ts",
      "@erp/admin-ui-host": "./packages/admin-ui-host/src/index.ts",
      "@erp/ui-runtime": "./packages/ui-runtime/src/index.ts",
      "@erp/extensions": "./packages/extensions/src/index.ts",
      "@erp/process-forms": "./packages/process-forms/src/index.tsx",
      "@erp/process-designer": "./packages/process-designer/src/index.tsx",
      "@erp/platform-core": "./packages/platform-core/src/index.ts",
    },
  },
  transpilePackages: [
    "@erp/ui",
    "@erp/platform-core",
    "@erp/process-designer",
    "@erp/process-forms",
    "@erp/admin-ui-host",
    "@erp/ui-runtime",
    "@erp/workflow",
    "@erp/extensions",
  ],
  allowedDevOrigins: ["150.242.201.102", "localhost", "127.0.0.1"],
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${GATEWAY_URL}/api/:path*` }];
  },
};

export default nextConfig;
