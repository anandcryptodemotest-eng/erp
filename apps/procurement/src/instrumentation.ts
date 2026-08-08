import { validateAuthSecrets } from "@erp/auth";

export async function register() {
  if (process.env.NEXT_RUNTIME === "edge") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  validateAuthSecrets();
  if (process.env.OTEL_SDK_DISABLED === "true" || !process.env.OTEL_EXPORTER_OTLP_ENDPOINT) return;
  const { bootstrapTelemetry } = await import("@erp/telemetry/bootstrap");
  await bootstrapTelemetry({ serviceName: process.env.SERVICE_NAME || "procurement" });
}
