import type { NextConfig } from "next";

/** Shared OTEL / Node packages that must not be webpack-bundled (needs `stream`, etc.). */
const TELEMETRY_EXTERNALS = [
  "@erp/telemetry",
  "@opentelemetry/auto-instrumentations-node",
  "@opentelemetry/api",
  "@opentelemetry/exporter-metrics-otlp-http",
  "@opentelemetry/exporter-trace-otlp-http",
  "@opentelemetry/resources",
  "@opentelemetry/sdk-node",
  "@opentelemetry/sdk-metrics",
  "@opentelemetry/semantic-conventions",
  "@grpc/grpc-js",
  "@grpc/proto-loader",
] as const;

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: [...TELEMETRY_EXTERNALS],
  transpilePackages: ["@erp/ui", "@erp/types", "@erp/auth", "@erp/config", "@erp/logger"],
};
export default nextConfig;
