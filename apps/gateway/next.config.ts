import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@erp/ui", "@erp/types", "@erp/auth", "@erp/config"],
};

export default nextConfig;
