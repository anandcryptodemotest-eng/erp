import type { NextConfig } from "next";
import path from "path";

const monorepoRoot = path.join(__dirname, "../..");

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: monorepoRoot,
  serverExternalPackages: [
    "@erp/telemetry",
    "@opentelemetry/auto-instrumentations-node",
    "@opentelemetry/api",
    "@opentelemetry/exporter-metrics-otlp-http",
    "@opentelemetry/exporter-trace-otlp-http",
    "@opentelemetry/resources",
    "@opentelemetry/sdk-node",
    "@opentelemetry/sdk-metrics",
    "@opentelemetry/semantic-conventions",
  ],
  transpilePackages: ["@erp/ui", "@erp/types", "@erp/auth", "@erp/config", "@erp/logger", "@erp/documents", "@erp/workflow", "@erp/tax-india"],
};
export default nextConfig;
