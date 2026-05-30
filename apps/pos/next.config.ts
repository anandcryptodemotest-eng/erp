import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@erp/ui", "@erp/types"],
};

export default nextConfig;
