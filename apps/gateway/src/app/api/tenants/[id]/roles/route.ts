import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyToken, extractToken } from "@erp/auth";

const BUILTIN_ROLES = [
  "ADMIN",
  "MANAGER",
  "PROCESS_OWNER",
  "CATALOG_MANAGER",
  "SALES_EXECUTIVE",
  "PRICING_EXECUTIVE",
  "DISPATCH_EXECUTIVE",
  "DELIVERY_EXECUTIVE",
  "ACCOUNTANT",
  "PROCUREMENT_OFFICER",
  "USER",
] as const;

const ROLES_KEY = "oms.roles";

type Params = { params: Promise<{ id: string }> };

async function requireMember(request: Request, tenantId: string) {
  const token = extractToken(request.headers.get("authorization"));
  if (!token) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const auth = await verifyToken(token);
  if (!auth) return { error: NextResponse.json({ error: "Invalid token" }, { status: 401 }) };
  const caller = await prisma.tenantUser.findUnique({
    where: { tenantId_userId: { tenantId, userId: auth.userId } },
  });
  if (!caller?.isActive) {
    return { error: NextResponse.json({ error: "Tenant not found" }, { status: 404 }) };
  }
  return { auth, caller };
}

async function loadRoles(tenantId: string): Promise<string[]> {
  const row = await prisma.tenantSetting.findUnique({
    where: { tenantId_key: { tenantId, key: ROLES_KEY } },
  });
  let custom: string[] = [];
  if (row?.value) {
    try {
      const parsed = JSON.parse(row.value) as unknown;
      if (Array.isArray(parsed)) custom = parsed.filter((x): x is string => typeof x === "string");
    } catch {
      custom = [];
    }
  }
  return [...new Set([...BUILTIN_ROLES, ...custom])];
}

/** GET /api/tenants/:id/roles */
export async function GET(request: Request, { params }: Params) {
  const { id } = await params;
  const gate = await requireMember(request, id);
  if ("error" in gate && gate.error) return gate.error;

  const roles = await loadRoles(id);
  return NextResponse.json({ data: roles, meta: { builtin: BUILTIN_ROLES } });
}

const createRoleSchema = z.object({
  role: z
    .string()
    .min(2)
    .max(64)
    .regex(/^[A-Z][A-Z0-9_]*$/, "Use UPPER_SNAKE_CASE (e.g. CREDIT_MANAGER)"),
});

/** POST /api/tenants/:id/roles — add a custom role (ADMIN) */
export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const gate = await requireMember(request, id);
  if ("error" in gate && gate.error) return gate.error;
  if (gate.caller!.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { role } = createRoleSchema.parse(body);
    const current = await loadRoles(id);
    if (current.includes(role)) {
      return NextResponse.json({ data: current, message: "Role already exists" });
    }

    const row = await prisma.tenantSetting.findUnique({
      where: { tenantId_key: { tenantId: id, key: ROLES_KEY } },
    });
    let custom: string[] = [];
    if (row?.value) {
      try {
        const parsed = JSON.parse(row.value) as unknown;
        if (Array.isArray(parsed)) custom = parsed.filter((x): x is string => typeof x === "string");
      } catch {
        custom = [];
      }
    }
    custom = [...new Set([...custom, role])];

    await prisma.tenantSetting.upsert({
      where: { tenantId_key: { tenantId: id, key: ROLES_KEY } },
      create: { tenantId: id, key: ROLES_KEY, value: JSON.stringify(custom) },
      update: { value: JSON.stringify(custom) },
    });

    const roles = await loadRoles(id);
    return NextResponse.json({ data: roles, message: `Role ${role} added` }, { status: 201 });
  } catch (e: unknown) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.errors[0]?.message ?? "Invalid role" }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to add role" }, { status: 500 });
  }
}
