import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeCustomerPhone } from "@/lib/customer-phone";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

// GET /api/customers/search
export async function GET(request: Request) {
  const tenantId = request.headers.get("x-tenant-id");
  const role = request.headers.get("x-user-role");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });
  if (!role) return NextResponse.json({ error: "Auth required" }, { status: 401 });
  if (role === "CUSTOMER") return NextResponse.json({ error: "Customer directory access denied" }, { status: 403 });

  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.trim();
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number.parseInt(url.searchParams.get("limit") ?? `${DEFAULT_LIMIT}`, 10) || DEFAULT_LIMIT));

  if (!query || query.length < 2) {
    return NextResponse.json({ data: [], meta: { limit, total: 0, pages: 0 } });
  }

  const normalizedPhone = normalizeCustomerPhone(query);
  const where = {
    tenantId,
    isActive: true,
    OR: [
      ...(normalizedPhone ? [{ phoneNormalized: { contains: normalizedPhone } }] : []),
      { email: { contains: query, mode: "insensitive" as const } },
      { name: { contains: query, mode: "insensitive" as const } },
      { customerGroup: { contains: query, mode: "insensitive" as const } },
    ],
  };

  const [exactPhoneCustomers, customers] = await Promise.all([
    normalizedPhone
      ? prisma.customer.findMany({
          where: { tenantId, isActive: true, phoneNormalized: normalizedPhone },
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            phoneNormalized: true,
            customerGroup: true,
            portalUserId: true,
          },
        })
      : Promise.resolve([]),
    prisma.customer.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        phoneNormalized: true,
        customerGroup: true,
        portalUserId: true,
      },
      take: limit,
    }),
  ]);

  const results = [...exactPhoneCustomers, ...customers.filter((customer) => !exactPhoneCustomers.some((exact) => exact.id === customer.id))];
  const ranked = results
    .map((customer) => {
      const normalizedEmail = customer.email?.toLowerCase() ?? "";
      const normalizedQuery = query.toLowerCase();
      const rank = customer.phoneNormalized === normalizedPhone
        ? 0
        : normalizedEmail === normalizedQuery
          ? 1
          : customer.name.toLowerCase() === normalizedQuery
            ? 2
            : customer.customerGroup?.toLowerCase() === normalizedQuery
              ? 3
              : 4;
      return { customer, rank };
    })
    .sort((left, right) => left.rank - right.rank || left.customer.name.localeCompare(right.customer.name))
    .slice(0, limit)
    .map(({ customer }) => customer);

  return NextResponse.json({ data: ranked, meta: { limit, total: ranked.length, pages: ranked.length ? 1 : 0 } });
}