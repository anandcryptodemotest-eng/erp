/**
 * Process-wide OpenTelemetry bootstrap. Call once from instrumentation.ts.
 * Feature code must not import raw @opentelemetry/* — use helpers from @erp/telemetry.
 *
 * All OTEL deps are loaded via dynamic import so Next.js webpack does not
 * pull Node-only packages (`stream`, `fs`, `@grpc/grpc-js`) into the compile graph.
 */

import { hostname } from "node:os";

let started = false;
let sdk: { shutdown: () => Promise<void> } | null = null;

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

  const [
    { NodeSDK },
    { getNodeAutoInstrumentations },
    { OTLPTraceExporter },
    { OTLPMetricExporter },
    { PeriodicExportingMetricReader },
    { resourceFromAttributes },
    semconv,
  ] = await Promise.all([
    import("@opentelemetry/sdk-node"),
    import("@opentelemetry/auto-instrumentations-node"),
    import("@opentelemetry/exporter-trace-otlp-http"),
    import("@opentelemetry/exporter-metrics-otlp-http"),
    import("@opentelemetry/sdk-metrics"),
    import("@opentelemetry/resources"),
    import("@opentelemetry/semantic-conventions"),
  ]);

  const serviceName =
    opts.serviceName || process.env.OTEL_SERVICE_NAME || process.env.SERVICE_NAME || "erp";
  const serviceVersion =
    opts.serviceVersion || process.env.SERVICE_VERSION || process.env.npm_package_version || "1.0.0";
  const env = process.env.DEPLOYMENT_ENVIRONMENT || process.env.NODE_ENV || "development";
  const base = endpointBase(opts.otlpEndpoint);

  const resource = resourceFromAttributes({
    [semconv.ATTR_SERVICE_NAME]: serviceName,
    [semconv.ATTR_SERVICE_VERSION]: serviceVersion,
    [semconv.ATTR_SERVICE_NAMESPACE]: "erp",
    "deployment.environment": env,
    "host.name": hostname(),
  });

  const nodeSdk = new NodeSDK({
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

  await nodeSdk.start();
  sdk = nodeSdk;
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
