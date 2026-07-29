import type { ServiceEvent, ModuleId } from "@erp/types";
import { createLogger, getRequestContext, requestIdHeaders } from "@erp/logger";
import { injectTraceHeaders } from "@erp/telemetry";

const log = createLogger({ service: "service-client" });

// Keep in sync with @erp/config services registry (gateway/core = 3010)
const SERVICE_PORTS: Record<string, number> = {
  core: 3010,
  sales: 3001,
  inventory: 3002,
  accounting: 3003,
  hr: 3004,
  procurement: 3005,
  delivery: 3006,
};

const PROPAGATED_CTX_HEADERS = [
  "traceparent",
  "tracestate",
  "baggage",
  "x-request-id",
  "x-correlation-id",
  "x-tenant-id",
  "x-user-id",
] as const;

function getServiceUrl(moduleId: ModuleId): string {
  const baseUrl = process.env[`${moduleId.toUpperCase()}_SERVICE_URL`];
  return baseUrl || `http://localhost:${SERVICE_PORTS[moduleId] ?? 3000}`;
}

/**
 * Inter-service HTTP client for service-to-service communication.
 * Propagates request ids + W3C trace context from ALS / active span.
 */
export class ServiceClient {
  private serviceSecret: string;

  constructor() {
    this.serviceSecret = process.env.SERVICE_SECRET || "dev-service-secret";
  }

  async call<T>(
    targetService: ModuleId,
    path: string,
    options: {
      method?: string;
      body?: unknown;
      tenantId?: string;
      userId?: string;
      requestId?: string;
    } = {}
  ): Promise<{ data?: T; error?: string; status: number }> {
    const baseUrl = getServiceUrl(targetService);
    const url = `${baseUrl}${path}`;
    const method = options.method || "GET";
    const started = Date.now();

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "x-service-key": this.serviceSecret,
        ...requestIdHeaders(),
      };

      const ctx = getRequestContext();
      if (options.tenantId || ctx?.tenantId) {
        headers["x-tenant-id"] = options.tenantId ?? ctx!.tenantId!;
      }
      if (options.userId || ctx?.userId) {
        headers["x-user-id"] = options.userId ?? ctx!.userId!;
      }
      if (options.requestId) headers["x-request-id"] = options.requestId;

      injectTraceHeaders(headers);

      // Ensure required propagation keys are present when known from ALS
      for (const key of PROPAGATED_CTX_HEADERS) {
        if (key === "x-request-id" && !headers[key] && ctx?.requestId) {
          headers[key] = ctx.requestId;
        }
        if (key === "x-correlation-id" && !headers[key] && ctx?.correlationId) {
          headers[key] = ctx.correlationId;
        }
      }

      const response = await fetch(url, {
        method,
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined,
      });

      const data = await response.json();
      const ms = Date.now() - started;

      if (response.status >= 500) {
        log.error("downstream_error", {
          target: targetService,
          path,
          method,
          status: response.status,
          ms,
          tenantId: options.tenantId ?? ctx?.tenantId,
        });
      } else {
        log.debug("downstream_ok", {
          target: targetService,
          path,
          method,
          status: response.status,
          ms,
        });
      }

      return { data, status: response.status };
    } catch (error) {
      log.error("downstream_unavailable", {
        target: targetService,
        path,
        method,
        ms: Date.now() - started,
        err: error,
      });
      return { error: `Service ${targetService} unavailable`, status: 503 };
    }
  }

  async emit(event: ServiceEvent, targetServices: ModuleId[]): Promise<void> {
    const promises = targetServices.map((service) =>
      this.call(service, "/api/events", {
        method: "POST",
        body: event,
      }).catch((err) => {
        log.error("event_delivery_failed", { target: service, err });
      })
    );

    await Promise.allSettled(promises);
  }
}

export const serviceClient = new ServiceClient();
