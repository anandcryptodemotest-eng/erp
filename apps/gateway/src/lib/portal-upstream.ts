import { prisma } from "@/lib/prisma";
import { getServiceSecret } from "@erp/auth";

const INVENTORY_URL = process.env.INVENTORY_SERVICE_URL ?? "http://127.0.0.1:3002";
const SALES_URL = process.env.SALES_SERVICE_URL ?? "http://127.0.0.1:3001";

function serviceHeaders(tenantId: string, extra?: HeadersInit): Headers {
  const h = new Headers(extra);
  h.set("Content-Type", "application/json");
  h.set("x-service-key", getServiceSecret());
  h.set("x-tenant-id", tenantId);
  return h;
}

/** Resolve tenant id from JWT-injected header, x-tenant-id, or public slug. */
export async function resolvePortalTenantId(request: Request): Promise<string | null> {
  const fromJwtOrHeader = request.headers.get("x-tenant-id")?.trim();
  if (fromJwtOrHeader) return fromJwtOrHeader;

  const url = new URL(request.url);
  const slug = (
    request.headers.get("x-tenant-slug") ||
    url.searchParams.get("tenant") ||
    url.searchParams.get("t") ||
    ""
  )
    .trim()
    .toLowerCase();
  if (!slug || !/^[a-z0-9-]+$/.test(slug)) return null;

  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    select: { id: true, isActive: true },
  });
  return tenant?.isActive ? tenant.id : null;
}

export async function portalInventory<T = unknown>(
  tenantId: string,
  path: string,
  init?: RequestInit
): Promise<{ status: number; json: T }> {
  const res = await fetch(`${INVENTORY_URL}${path}`, {
    ...init,
    headers: serviceHeaders(tenantId, init?.headers),
    cache: "no-store",
  });
  const json = (await res.json()) as T;
  return { status: res.status, json };
}

export async function portalSales<T = unknown>(
  tenantId: string,
  path: string,
  init?: RequestInit
): Promise<{ status: number; json: T }> {
  const res = await fetch(`${SALES_URL}${path}`, {
    ...init,
    headers: serviceHeaders(tenantId, init?.headers),
    cache: "no-store",
  });
  const json = (await res.json()) as T;
  return { status: res.status, json };
}
