/**
 * Identical health payload contract for all backends.
 */

export type CheckStatus = "UP" | "DOWN" | "DEGRADED";

export interface HealthPayload {
  status: CheckStatus;
  service: string;
  version: string;
  uptimeSeconds: number;
  checks: Record<string, CheckStatus>;
}

const startedAt = Date.now();

export function serviceVersion(): string {
  return process.env.SERVICE_VERSION || process.env.npm_package_version || "1.0.0";
}

export function livePayload(service: string): HealthPayload {
  return {
    status: "UP",
    service,
    version: serviceVersion(),
    uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
    checks: {
      process: "UP",
    },
  };
}

export function readyPayload(
  service: string,
  checks: Record<string, CheckStatus>
): HealthPayload {
  const values = Object.values(checks);
  const status: CheckStatus = values.every((c) => c === "UP")
    ? "UP"
    : values.some((c) => c === "DOWN")
      ? "DOWN"
      : "DEGRADED";
  return {
    status,
    service,
    version: serviceVersion(),
    uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
    checks,
  };
}

export function telemetryCheck(): CheckStatus {
  if (process.env.OTEL_SDK_DISABLED === "true") return "UP";
  // Soft: exporter may be down; process still ready if SDK not hard-required
  return "UP";
}
