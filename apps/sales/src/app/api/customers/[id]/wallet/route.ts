import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const walletSchema = z.object({
  amount: z.number().positive(),
  type: z.enum(["CREDIT", "DEBIT"]),
  notes: z.string().optional(),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const tenantId = request.headers.get("x-tenant-id")!;
  const role = request.headers.get("x-user-role");
  const { id } = await params;

  if (!["ADMIN", "MANAGER"].includes(role ?? "")) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const customer = await prisma.customer.findFirst({ where: { id, tenantId, isActive: true } });
  if (!customer) return NextResponse.json({ error: "Customer not found" }, { status: 404 });

  const body = await request.json().catch(() => null);
  const parsed = walletSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }

  const { amount, type } = parsed.data;
  const currentBalance = Number(customer.wallet ?? 0);

  if (type === "DEBIT" && currentBalance < amount) {
    return NextResponse.json(
      { error: `Insufficient wallet balance. Current: ${currentBalance}` },
      { status: 409 }
    );
  }

  const newBalance = type === "CREDIT" ? currentBalance + amount : currentBalance - amount;

  const updated = await prisma.customer.update({
    where: { id },
    data: { wallet: newBalance },
    select: { id: true, name: true, wallet: true },
  });
  return NextResponse.json({ data: updated });
}
