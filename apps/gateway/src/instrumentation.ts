export async function register() {
  if (process.env.NEXT_RUNTIME === "edge") return;
  const { bootstrapTelemetry } = await import("@erp/telemetry");
  await bootstrapTelemetry({ serviceName: process.env.SERVICE_NAME || "gateway" });
}
