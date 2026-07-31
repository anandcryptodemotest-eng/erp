/**
 * Identical health payload contract for all backends.
 */

export type CheckStatus = "UP" | "DOWN" | "DEGRADED";

export interface HealthPayload {
  status: CheckStatus;
  service: string;
  version: string;
  build: string;
  commit: string;
  startedAt: string;
  uptimeSeconds: number;
  live?: boolean;
  ready?: boolean;
  checks: Record<string, CheckStatus>;
}

const startedAtMs = Date.now();
const startedAtIso = new Date(startedAtMs).toISOString();

export function serviceVersion(): string {
  return process.env.SERVICE_VERSION || process.env.npm_package_version || "1.0.0";
}

export function serviceBuild(): string {
  return process.env.BUILD_ID || process.env.GIT_SHA || process.env.SERVICE_VERSION || "dev";
}

export function serviceCommit(): string {
  return process.env.GIT_SHA || process.env.BUILD_ID || "dev";
}

function baseMeta(service: string) {
  return {
    service,
    version: serviceVersion(),
    build: serviceBuild(),
    commit: serviceCommit(),
    startedAt: startedAtIso,
    uptimeSeconds: Math.floor((Date.now() - startedAtMs) / 1000),
  };
}

export function livePayload(service: string): HealthPayload {
  return {
    ...baseMeta(service),
    status: "UP",
    live: true,
    checks: { process: "UP" },
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
    ...baseMeta(service),
    status,
    ready: status === "UP",
    live: true,
    checks,
  };
}

export function telemetryCheck(): CheckStatus {
  if (process.env.OTEL_SDK_DISABLED === "true") return "UP";
  return "UP";
}
