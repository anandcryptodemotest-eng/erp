import { NextResponse } from "next/server";
import { serviceClient } from "@erp/config";
import { verifyToken, extractToken } from "@erp/auth";
import { prisma } from "@/lib/prisma";

type CustomerSearchResult = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  customerGroup: string | null;
  portalUserId: string | null;
};

export async function GET(request: Request) {
  const token = extractToken(request.headers.get("authorization"));
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const auth = await verifyToken(token);
  if (!auth) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

  const tenantId = request.headers.get("x-tenant-id") || auth.tenantId;
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });
  if (auth.role === "CUSTOMER") return NextResponse.json({ error: "Directory access denied" }, { status: 403 });

  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.trim() ?? "";
  const limit = Math.min(20, Math.max(1, Number.parseInt(url.searchParams.get("limit") ?? "10", 10) || 10));
  if (query.length < 2) return NextResponse.json({ data: [], meta: { total: 0, limit } });

  const [users, customerResponse] = await Promise.all([
    prisma.user.findMany({
      where: {
        isActive: true,
        tenants: { some: { tenantId, isActive: true } },
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { email: { contains: query, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        name: true,
        email: true,
        tenants: { where: { tenantId, isActive: true }, select: { role: true }, take: 1 },
      },
      take: limit,
    }),
    serviceClient.call<{ data?: CustomerSearchResult[] }>("sales", `/api/customers/search?q=${encodeURIComponent(query)}&limit=${limit}`, {
      tenantId,
      userId: auth.userId,
      role: auth.role,
    }),
  ]);

  const customers = customerResponse.status === 200 ? customerResponse.data?.data ?? [] : [];
  const data = [
    ...users.map((user) => ({
      id: user.id,
      kind: "STAFF" as const,
      name: user.name || user.email,
      email: user.email,
      phone: null,
      role: user.tenants[0]?.role ?? "USER",
      customerGroup: null,
    })),
    ...customers
      .filter((customer) => customer.portalUserId)
      .map((customer) => ({
        id: customer.id,
        kind: "CUSTOMER" as const,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        role: null,
        customerGroup: customer.customerGroup,
      })),
  ].slice(0, limit);

  return NextResponse.json({ data, meta: { total: data.length, limit, pages: data.length ? 1 : 0 } });
}