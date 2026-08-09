import { NextResponse } from "next/server";
import { verifyToken, extractToken } from "@erp/auth";
import { prisma } from "@/lib/prisma";
import {
  roleDefaultConfig,
  resolveWidgets,
  allowedWidgets,
  listWidgets,
  registerDashboardWidgets,
} from "@erp/ui";
import type {
  DashboardConfig,
  DashboardPortal,
  DashboardAuthContext,
  DashboardPlacement,
} from "@erp/ui";

/**
 * GET /api/dashboard/config?portal=ADMIN|CUSTOMER
 * Returns the effective dashboard config for the authenticated user:
 *   - user preference if present, else role default
 *   - permission-filtered (module + capability gates) — stored widgets never grant access
 * Returns the resolved placements + the catalog of widgets the user may add.
 */
export async function GET(request: Request) {
  registerDashboardWidgets();
  const token = extractToken(request.headers.get("authorization"));
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const auth = await verifyToken(token);
  if (!auth) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

  const url = new URL(request.url);
  const portal = (url.searchParams.get("portal") as DashboardPortal) ?? "ADMIN";
  const tenantId = request.headers.get("x-tenant-id") || auth.tenantId;

  let provisionedCapabilities: string[] = [];
  if (tenantId) {
    const rows = await prisma.tenantCapability.findMany({
      where: { tenantId },
      select: { key: true },
    });
    provisionedCapabilities = rows.map((r) => r.key);
  }

  const ctx: DashboardAuthContext = {
    userId: auth.userId,
    role: auth.role,
    modules: auth.modules,
    capabilities: auth.capabilities ?? [],
    provisionedCapabilities,
  };

  // Load user preference (or role default).
  const pref = await prisma.dashboardPreference.findUnique({
    where: { userId_portal: { userId: auth.userId, portal } },
  });

  const stored = Array.isArray(pref?.config)
    ? (pref.config as unknown as DashboardPlacement[])
    : [];
  const useStored = stored.length > 0;
  const config: DashboardConfig = useStored
    ? { dashboard: portal, layout: { columns: 12 }, widgets: stored }
    : roleDefaultConfig(auth.role, portal);

  const resolved = resolveWidgets(config.widgets, ctx, portal);
  const catalog = allowedWidgets(ctx, portal).map((w) => ({
    id: w.id,
    name: w.name,
    description: w.description,
    category: w.category,
    defaultWidth: w.defaultWidth,
    defaultHeight: w.defaultHeight,
  }));

  return NextResponse.json({
    data: {
      config,
      resolved,
      catalog,
      isDefault: !useStored,
      auth: {
        role: auth.role,
        modules: ctx.modules,
        capabilities: ctx.capabilities,
      },
    },
  });
}

/**
 * PUT /api/dashboard/config?portal=ADMIN|CUSTOMER
 * Saves the user's dashboard layout preference. Storing a widget NEVER grants
 * access — GET re-filters on every read.
 */
export async function PUT(request: Request) {
  registerDashboardWidgets();
  const token = extractToken(request.headers.get("authorization"));
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const auth = await verifyToken(token);
  if (!auth) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

  const url = new URL(request.url);
  const portal = (url.searchParams.get("portal") as DashboardPortal) ?? "ADMIN";

  const body = (await request.json()) as { widgets?: DashboardPlacement[] };
  const widgets = Array.isArray(body.widgets) ? body.widgets : [];

  // Validate placed widget types against the registry (reject unknown ids).
  const known = new Set(listWidgets().map((w) => w.id));
  const valid = widgets.filter((w) => known.has(w.type));
  if (valid.length === 0) {
    return NextResponse.json(
      { error: "Cannot save an empty layout. Restore default, then Save again." },
      { status: 400 }
    );
  }

  await prisma.dashboardPreference.upsert({
    where: { userId_portal: { userId: auth.userId, portal } },
    create: { userId: auth.userId, portal, config: valid as unknown as object },
    update: { config: valid as unknown as object },
  });

  return NextResponse.json({ data: { saved: true, count: valid.length } });
}

/**
 * DELETE /api/dashboard/config?portal=ADMIN|CUSTOMER
 * Resets the user's dashboard to the role default (removes their preference).
 */
export async function DELETE(request: Request) {
  const token = extractToken(request.headers.get("authorization"));
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const auth = await verifyToken(token);
  if (!auth) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

  const url = new URL(request.url);
  const portal = (url.searchParams.get("portal") as DashboardPortal) ?? "ADMIN";

  await prisma.dashboardPreference.deleteMany({
    where: { userId: auth.userId, portal },
  });

  return NextResponse.json({ data: { reset: true } });
}