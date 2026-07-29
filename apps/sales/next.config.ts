import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@erp/ui", "@erp/types", "@erp/auth", "@erp/config", "@erp/workflow", "@erp/logger", "@erp/telemetry"],
};
export default nextConfig;
