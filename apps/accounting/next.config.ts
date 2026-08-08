import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  output: "standalone",
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
  transpilePackages: ["@erp/ui", "@erp/types", "@erp/auth", "@erp/config", "@erp/logger"],
};
export default nextConfig;
