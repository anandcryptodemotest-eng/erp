import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const validateSchema = z.object({
  code: z.string().min(1),
  userId: z.string().min(1),
  orderId: z.string().optional(),
  orderAmount: z.number().nonnegative(),
});

// POST /api/coupons/validate
export async function POST(request: NextRequest) {
  const tenantId = request.headers.get("x-tenant-id");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });

  const body = await request.json().catch(() => null);
  const parsed = validateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }

  const { code, userId, orderId, orderAmount } = parsed.data;
  const now = new Date();

  const coupon = await prisma.coupon.findFirst({
    where: { tenantId, code: code.toUpperCase(), isActive: true },
    include: { usages: { where: { userId } } },
  });

  if (!coupon) {
    return NextResponse.json({ error: "Invalid or expired coupon code" }, { status: 404 });
  }

  // Check date bounds
  if (coupon.startsAt && coupon.startsAt > now) {
    return NextResponse.json({ error: "Coupon is not yet active" }, { status: 400 });
  }
  if (coupon.endsAt && coupon.endsAt < now) {
    return NextResponse.json({ error: "Coupon has expired" }, { status: 400 });
  }

  // Check global usage limit
  if (coupon.usageLimit !== null && coupon.usageCount >= coupon.usageLimit) {
    return NextResponse.json({ error: "Coupon usage limit reached" }, { status: 400 });
  }

  // Check per-user limit
  if (coupon.usages.length >= coupon.perUserLimit) {
    return NextResponse.json({ error: "You have already used this coupon" }, { status: 400 });
  }

  // Check minimum order amount
  if (coupon.minOrderAmount !== null && orderAmount < coupon.minOrderAmount) {
    return NextResponse.json(
      { error: `Minimum order amount of ${coupon.minOrderAmount} required` },
      { status: 400 }
    );
  }

  // Calculate discount
  let discount = 0;
  if (coupon.type === "PERCENTAGE") {
    discount = (orderAmount * coupon.value) / 100;
    if (coupon.maxDiscount !== null) discount = Math.min(discount, coupon.maxDiscount);
  } else if (coupon.type === "FLAT_AMOUNT") {
    discount = Math.min(coupon.value, orderAmount);
  } else if (coupon.type === "FREE_DELIVERY") {
    discount = coupon.value; // value = max delivery fee waived
  }

  // Record usage and increment counter if orderId provided (finalize)
  if (orderId) {
    await prisma.$transaction([
      prisma.couponUsage.create({
        data: { couponId: coupon.id, tenantId, userId, orderId, discount },
      }),
      prisma.coupon.update({
        where: { id: coupon.id },
        data: { usageCount: { increment: 1 } },
      }),
    ]);
  }

  return NextResponse.json({
    data: {
      couponId: coupon.id,
      code: coupon.code,
      type: coupon.type,
      discount,
    },
  });
}
