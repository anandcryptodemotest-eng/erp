/**
 * Observability Runtime — tracing / metrics / exceptions.
 * Feature code: use only these helpers (never raw @opentelemetry/*).
 */

export { bootstrapTelemetry, isTelemetryStarted } from "./bootstrap";
export type { BootstrapOptions } from "./bootstrap";

export {
  withSpan,
  recordEvent,
  recordMetric,
  captureException,
  addSpanAttributes,
  injectTraceHeaders,
  activeTraceIds,
} from "./helpers";
export type { SpanAttrs } from "./helpers";

export {
  livePayload,
  readyPayload,
  telemetryCheck,
  serviceVersion,
  serviceBuild,
  serviceCommit,
} from "./health";
export type { HealthPayload, CheckStatus } from "./health";
