/**
 * Process-wide OpenTelemetry bootstrap. Call once from instrumentation.ts.
 * Feature code must not import raw @opentelemetry/* — use helpers from @erp/telemetry.
 */

import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { Resource } from "@opentelemetry/resources";
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
  ATTR_SERVICE_NAMESPACE,
} from "@opentelemetry/semantic-conventions";
import { hostname } from "node:os";

let started = false;
let sdk: NodeSDK | null = null;

export interface BootstrapOptions {
  serviceName: string;
  serviceVersion?: string;
  /** Default: OTEL_EXPORTER_OTLP_ENDPOINT or http://localhost:4318 */
  otlpEndpoint?: string;
}

function endpointBase(explicit?: string): string {
  return (
    explicit ||
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT ||
    process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT?.replace(/\/v1\/traces$/, "") ||
    "http://localhost:4318"
  ).replace(/\/$/, "");
}

export async function bootstrapTelemetry(opts: BootstrapOptions): Promise<void> {
  if (started) return;
  if (process.env.OTEL_SDK_DISABLED === "true") {
    started = true;
    return;
  }

  const serviceName =
    opts.serviceName || process.env.OTEL_SERVICE_NAME || process.env.SERVICE_NAME || "erp";
  const serviceVersion =
    opts.serviceVersion || process.env.SERVICE_VERSION || process.env.npm_package_version || "1.0.0";
  const env = process.env.DEPLOYMENT_ENVIRONMENT || process.env.NODE_ENV || "development";
  const base = endpointBase(opts.otlpEndpoint);

  const resource = new Resource({
    [ATTR_SERVICE_NAME]: serviceName,
    [ATTR_SERVICE_VERSION]: serviceVersion,
    [ATTR_SERVICE_NAMESPACE]: "erp",
    "deployment.environment": env,
    "host.name": hostname(),
  });

  sdk = new NodeSDK({
    resource,
    traceExporter: new OTLPTraceExporter({ url: `${base}/v1/traces` }),
    metricReader: new PeriodicExportingMetricReader({
      exporter: new OTLPMetricExporter({ url: `${base}/v1/metrics` }),
      exportIntervalMillis: Number(process.env.OTEL_METRIC_EXPORT_INTERVAL || 15000),
    }),
    instrumentations: [
      getNodeAutoInstrumentations({
        "@opentelemetry/instrumentation-fs": { enabled: false },
        "@opentelemetry/instrumentation-dns": { enabled: false },
        "@opentelemetry/instrumentation-net": { enabled: false },
      }),
    ],
  });

  await sdk.start();
  started = true;

  const shutdown = async () => {
    try {
      await sdk?.shutdown();
    } catch {
      /* ignore */
    }
  };
  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);
}

export function isTelemetryStarted(): boolean {
  return started;
}
