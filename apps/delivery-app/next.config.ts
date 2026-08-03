import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@erp/types", "@erp/ui"],
};

export default nextConfig;
