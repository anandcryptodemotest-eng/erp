import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { expireStaleBatches, findExpiringBatches } from "@/lib/stock-batches";

// GET /api/stock/expiring — perishable batches at or near expiry (FEFO / markdown planning).
//   ?withinDays=3     look ahead N days (default 0 = already expired / expiring today)
//   ?includeExpired=1 include lots already past expiry
export async function GET(request: Request) {
  const tenantId = request.headers.get("x-tenant-id");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });

  const url = new URL(request.url);
  const withinDays = Math.max(0, parseInt(url.searchParams.get("withinDays") ?? "0"));
  const includeExpired = ["1", "true", "yes"].includes(
    (url.searchParams.get("includeExpired") ?? "").toLowerCase()
  );

  const batches = await findExpiringBatches(prisma, {
    tenantId,
    withinDays,
    includeExpired,
  });

  const now = Date.now();
  const data = batches.map((b) => ({
    id: b.id,
    batchNo: b.batchNo,
    productId: b.productId,
    product: b.product,
    warehouseId: b.warehouseId,
    variantId: b.variantId,
    quantity: b.quantity,
    expiryDate: b.expiryDate,
    receivedDate: b.receivedDate,
    isExpired: b.isExpired,
    daysToExpiry:
      b.expiryDate != null
        ? Math.floor((new Date(b.expiryDate).getTime() - now) / 86_400_000)
        : null,
  }));

  return NextResponse.json({ data, meta: { total: data.length, withinDays, includeExpired } });
}

// POST /api/stock/expiring/sweep — write off lots past expiry: zero their remaining
// quantity, flag isExpired, and decrement the aggregate WarehouseStock with an
// ADJUSTMENT movement per lot. Idempotent. Intended to be run on a schedule (cron/hook)
// or triggered manually by an ops user.
export async function POST(request: Request) {
  const tenantId = request.headers.get("x-tenant-id");
  const role = request.headers.get("x-user-role");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });
  if (role && !["ADMIN", "MANAGER"].includes(role)) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const writtenOff = await prisma.$transaction((tx) =>
    expireStaleBatches(tx, { tenantId })
  );

  const totalQty = writtenOff.reduce((sum, w) => sum + w.quantity, 0);
  return NextResponse.json({
    data: writtenOff,
    meta: { lots: writtenOff.length, totalQty },
  });
}
