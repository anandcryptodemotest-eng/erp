/**
 * Shared structured logger for ERP microservices (Node runtime).
 * Edge middleware must import `@erp/logger/ids` instead.
 */

import { AsyncLocalStorage } from "node:async_hooks";
import {
  resolveRequestIds,
  REQUEST_ID_HEADER,
  CORRELATION_ID_HEADER,
} from "./ids";

export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogFields = Record<string, unknown>;

export interface RequestContext {
  requestId: string;
  correlationId?: string;
  tenantId?: string;
  userId?: string;
  userRole?: string;
  service?: string;
  path?: string;
  method?: string;
  workflowId?: string;
  taskId?: string;
  orderId?: string;
}

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const als = new AsyncLocalStorage<RequestContext>();

export {
  resolveRequestIds,
  REQUEST_ID_HEADER,
  CORRELATION_ID_HEADER,
} from "./ids";

export function getRequestContext(): RequestContext | undefined {
  return als.getStore();
}

export function runWithRequestContext<T>(ctx: RequestContext, fn: () => T): T {
  return als.run(ctx, fn);
}

export async function runWithRequestContextAsync<T>(
  ctx: RequestContext,
  fn: () => Promise<T>
): Promise<T> {
  return als.run(ctx, fn);
}

export function requestIdHeaders(ctx?: RequestContext | null): Record<string, string> {
  const store = ctx ?? getRequestContext();
  if (!store?.requestId) return {};
  const out: Record<string, string> = { [REQUEST_ID_HEADER]: store.requestId };
  if (store.correlationId) out[CORRELATION_ID_HEADER] = store.correlationId;
  return out;
}

function envLevel(): LogLevel {
  const raw = (process.env.LOG_LEVEL ?? "info").toLowerCase();
  if (raw === "debug" || raw === "info" || raw === "warn" || raw === "error") return raw;
  return "info";
}

function envPretty(): boolean {
  if (process.env.LOG_FORMAT === "json") return false;
  if (process.env.LOG_FORMAT === "pretty") return true;
  return process.env.NODE_ENV !== "production";
}

function safeError(err: unknown): LogFields {
  if (err instanceof Error) {
    return {
      errName: err.name,
      errMessage: err.message,
      errStack: err.stack?.split("\n").slice(0, 8).join("\n"),
    };
  }
  return { errMessage: String(err) };
}

function activeTraceIds(): { traceId?: string; spanId?: string } {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const api = require("@opentelemetry/api") as typeof import("@opentelemetry/api");
    const span = api.trace.getActiveSpan();
    if (!span) return {};
    const sc = span.spanContext();
    if (!sc.traceId || sc.traceId === "00000000000000000000000000000000") return {};
    return { traceId: sc.traceId, spanId: sc.spanId };
  } catch {
    return {};
  }
}

export interface Logger {
  service: string;
  debug(message: string, fields?: LogFields): void;
  info(message: string, fields?: LogFields): void;
  warn(message: string, fields?: LogFields): void;
  error(message: string, fields?: LogFields | { err?: unknown }): void;
  child(fields: LogFields): Logger;
}

function write(
  service: string,
  level: LogLevel,
  message: string,
  fields: LogFields | undefined,
  base: LogFields
) {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[envLevel()]) return;

  const ctx = getRequestContext();
  const { traceId, spanId } = activeTraceIds();
  const payload: LogFields = {
    timestamp: new Date().toISOString(),
    level,
    service,
    message,
    ...base,
    ...(ctx
      ? {
          requestId: ctx.requestId,
          correlationId: ctx.correlationId ?? ctx.requestId,
          tenantId: ctx.tenantId,
          userId: ctx.userId,
          userRole: ctx.userRole,
          path: ctx.path,
          method: ctx.method,
          workflowId: ctx.workflowId,
          taskId: ctx.taskId,
          orderId: ctx.orderId,
        }
      : {}),
    ...(traceId ? { traceId, spanId } : {}),
    ...fields,
  };

  for (const k of Object.keys(payload)) {
    if (/secret|password|authorization|token/i.test(k)) {
      payload[k] = "[redacted]";
    }
  }

  const line = envPretty()
    ? `[${payload.timestamp}] ${level.toUpperCase()} ${service}${ctx?.requestId ? ` req=${String(ctx.requestId).slice(0, 8)}` : ""} ${message}${
        fields && Object.keys(fields).length
          ? " " + JSON.stringify(fields)
          : ""
      }`
    : JSON.stringify(payload);

  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export function createLogger(opts: { service: string; base?: LogFields } = { service: "erp" }): Logger {
  const service = opts.service || process.env.SERVICE_NAME || "erp";
  const base = opts.base ?? {};

  const logger: Logger = {
    service,
    debug(message, fields) {
      write(service, "debug", message, fields, base);
    },
    info(message, fields) {
      write(service, "info", message, fields, base);
    },
    warn(message, fields) {
      write(service, "warn", message, fields, base);
    },
    error(message, fields) {
      const f = { ...(fields ?? {}) } as LogFields;
      if ("err" in f) {
        Object.assign(f, safeError(f.err));
        delete f.err;
      }
      write(service, "error", message, f, base);
    },
    child(fields) {
      return createLogger({ service, base: { ...base, ...fields } });
    },
  };
  return logger;
}

export function contextFromHeaders(
  headers: Headers | { get(name: string): string | null },
  extra?: Partial<RequestContext>
): RequestContext {
  const { requestId, correlationId } = resolveRequestIds(headers);
  return {
    requestId,
    correlationId,
    tenantId: headers.get("x-tenant-id") ?? undefined,
    userId: headers.get("x-user-id") ?? undefined,
    userRole: headers.get("x-user-role") ?? undefined,
    ...extra,
  };
}

export function withRequestLog<T extends Request>(
  service: string,
  handler: (req: T, ctx: RequestContext) => Promise<Response>
): (req: T) => Promise<Response> {
  const log = createLogger({ service });
  return async (req: T) => {
    const ctx = contextFromHeaders(req.headers, {
      service,
      method: req.method,
      path: new URL(req.url).pathname,
    });
    return runWithRequestContextAsync(ctx, async () => {
      const started = Date.now();
      try {
        const res = await handler(req, ctx);
        log.info("handler_done", {
          status: res.status,
          ms: Date.now() - started,
        });
        const headers = new Headers(res.headers);
        headers.set(REQUEST_ID_HEADER, ctx.requestId);
        headers.set(CORRELATION_ID_HEADER, ctx.correlationId ?? ctx.requestId);
        return new Response(res.body, {
          status: res.status,
          statusText: res.statusText,
          headers,
        });
      } catch (err) {
        log.error("handler_error", { err, ms: Date.now() - started });
        throw err;
      }
    });
  };
}

export const log = createLogger({
  service: process.env.SERVICE_NAME || "erp",
});
