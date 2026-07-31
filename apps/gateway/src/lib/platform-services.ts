import { services, getServiceUrl } from "@erp/config";
import type { ModuleId } from "@erp/types";
import type { ServiceHealthRow, ServiceHealthStatus } from "@erp/platform-core";

const TIMEOUT_MS = 2000;

type ProbeBody = {
  status?: string;
  service?: string;
  version?: string;
  build?: string;
  commit?: string;
  live?: boolean;
  ready?: boolean;
};

async function probe(url: string): Promise<{
  ok: boolean;
  ms: number;
  body: ProbeBody | null;
  error?: string;
}> {
  const started = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal, cache: "no-store" });
    const ms = Date.now() - started;
    const body = (await res.json().catch(() => null)) as ProbeBody | null;
    return { ok: res.ok, ms, body, error: res.ok ? undefined : `HTTP ${res.status}` };
  } catch (e) {
    return {
      ok: false,
      ms: Date.now() - started,
      body: null,
      error: e instanceof Error ? e.message : "probe failed",
    };
  } finally {
    clearTimeout(timer);
  }
}

function gatewayBase(): string {
  const raw = process.env.GATEWAY_URL || process.env.PLATFORM_GATEWAY_URL || "http://127.0.0.1:3010";
  return raw.replace(/\/$/, "");
}

function healthUrls(moduleId: string): { live: string; ready: string } {
  if (moduleId === "core") {
    const base = gatewayBase();
    // Gateway uses basePath /admin
    return {
      live: `${base}/admin/health/live`,
      ready: `${base}/admin/health/ready`,
    };
  }
  const base = getServiceUrl(moduleId as ModuleId).replace(/\/$/, "");
  return {
    live: `${base}/health/live`,
    ready: `${base}/health/ready`,
  };
}

function deriveStatus(liveOk: boolean, readyOk: boolean): ServiceHealthStatus {
  if (liveOk && readyOk) return "UP";
  if (liveOk && !readyOk) return "DEGRADED";
  return "DOWN";
}

/**
 * Registry-only health aggregation — never hardcode ports outside @erp/config.
 */
export async function aggregateServiceHealth(): Promise<ServiceHealthRow[]> {
  const environment =
    process.env.DEPLOYMENT_ENVIRONMENT || process.env.NODE_ENV || "development";
  const checkedAt = new Date().toISOString();

  const entries = Object.values(services);
  const rows = await Promise.all(
    entries.map(async (svc) => {
      const urls = healthUrls(svc.id);
      const [live, ready] = await Promise.all([probe(urls.live), probe(urls.ready)]);
      const status = deriveStatus(live.ok, ready.ok);
      const body = ready.body ?? live.body;
      const latencyMs =
        live.ok || ready.ok ? Math.max(live.ms, ready.ms) : live.ms || ready.ms || null;

      const row: ServiceHealthRow = {
        id: svc.id,
        name: svc.name,
        environment,
        status,
        live: live.ok,
        ready: ready.ok,
        version: body?.version ?? null,
        build: body?.build ?? null,
        commit: body?.commit ?? null,
        latencyMs,
        checkedAt,
        error: status === "DOWN" ? live.error || ready.error : undefined,
      };
      return row;
    })
  );

  return rows;
}
