import {
  context,
  propagation,
  trace,
  SpanStatusCode,
  metrics,
  type Span,
  type Attributes,
} from "@opentelemetry/api";
import { createLogger } from "@erp/logger";

const log = createLogger({ service: "telemetry" });

export type SpanAttrs = Record<string, string | number | boolean | undefined | null>;

function cleanAttrs(attrs?: SpanAttrs): Attributes {
  const out: Attributes = {};
  if (!attrs) return out;
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null) continue;
    out[k] = v;
  }
  return out;
}

/** Run `fn` inside a named business span (Domain.Action). */
export async function withSpan<T>(
  name: string,
  fn: (span: Span) => Promise<T> | T,
  attrs?: SpanAttrs
): Promise<T> {
  const tracer = trace.getTracer("erp", "1.0.0");
  return tracer.startActiveSpan(name, { attributes: cleanAttrs(attrs) }, async (span) => {
    try {
      const result = await fn(span);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (err) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: err instanceof Error ? err.message : String(err),
      });
      if (err instanceof Error) span.recordException(err);
      throw err;
    } finally {
      span.end();
    }
  });
}

/** Platform / lifecycle event on the active span (or a short marker span). */
export function recordEvent(name: string, attrs?: SpanAttrs): void {
  const span = trace.getActiveSpan();
  const cleaned = cleanAttrs(attrs);
  if (span) {
    span.addEvent(name, cleaned);
    return;
  }
  const tracer = trace.getTracer("erp", "1.0.0");
  const s = tracer.startSpan(name, { attributes: cleaned });
  s.addEvent(name, cleaned);
  s.end();
}

/** Record a custom numeric metric (Counter-style add). */
export function recordMetric(name: string, value: number, attrs?: SpanAttrs): void {
  const meter = metrics.getMeter("erp", "1.0.0");
  const counter = meter.createCounter(name);
  counter.add(value, cleanAttrs(attrs));
}

/** Exception tracking: enrich active span + structured log. */
export function captureException(
  error: unknown,
  contextFields?: SpanAttrs & { message?: string }
): void {
  const span = trace.getActiveSpan();
  if (error instanceof Error) {
    span?.recordException(error);
    span?.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
  } else {
    span?.setAttribute("exception.message", String(error));
  }
  if (contextFields) {
    for (const [k, v] of Object.entries(cleanAttrs(contextFields))) {
      span?.setAttribute(k, v);
    }
  }
  log.error(contextFields?.message || "exception", {
    err: error,
    ...cleanAttrs(contextFields),
  });
}

export function addSpanAttributes(attrs: SpanAttrs): void {
  const span = trace.getActiveSpan();
  if (!span) return;
  for (const [k, v] of Object.entries(cleanAttrs(attrs))) {
    span.setAttribute(k, v);
  }
}

/** Inject W3C + baggage into outbound HTTP headers (serviceClient). */
export function injectTraceHeaders(headers: Record<string, string>): void {
  propagation.inject(context.active(), headers, {
    set(carrier, key, value) {
      carrier[key] = value;
    },
  });
}

/** Active span ids for log correlation. */
export function activeTraceIds(): { traceId?: string; spanId?: string } {
  const span = trace.getActiveSpan();
  if (!span) return {};
  const sc = span.spanContext();
  if (!sc.traceId || sc.traceId === "00000000000000000000000000000000") return {};
  return { traceId: sc.traceId, spanId: sc.spanId };
}
