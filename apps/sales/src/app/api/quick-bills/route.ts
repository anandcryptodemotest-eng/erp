import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma";
import { serviceClient } from "@erp/config";
import {
  applyInventoryTaxRates,
  computeTotals,
  lineItemInputSchema,
  normalizeLineItems,
} from "@/lib/order-lines";
import { fetchTenantTaxProfile } from "@/lib/fetch-tenant-tax-profile";
import { assertSaasEntitlement } from "@/lib/assert-saas-entitlement";
import { TaxRegime, resolvePlaceOfSupply } from "@erp/tax-india";

const quickBillSchema = z.object({
  customerId: z.string().optional(),
  walkInName: z.string().min(1).optional(),
  placeOfSupply: z.string().optional(),
  items: lineItemInputSchema,
  paymentMethod: z.enum(["COD", "UPI", "CARD", "CASH"]).default("CASH"),
  issueBill: z.boolean().default(true),
});

/**
 * POST /api/quick-bills — walk-in Create Bill → same SalesOrder + Invoice path
 */
export async function POST(request: Request) {
  const tenantId = request.headers.get("x-tenant-id");
  const userId = request.headers.get("x-user-id");
  if (!tenantId || !userId) {
    return NextResponse.json({ error: "Auth context required" }, { status: 400 });
  }

  const entitlementBlock = await assertSaasEntitlement(tenantId, "quick_bill");
  if (entitlementBlock) return entitlementBlock;

  try {
    const body = quickBillSchema.parse(await request.json());
    const profile = await fetchTenantTaxProfile(tenantId);

    let customerId = body.customerId;
    if (!customerId) {
      const name = body.walkInName?.trim() || "Walk-in Customer";
      const walkIn = await prisma.customer.create({
        data: {
          tenantId,
          name,
          customerGroup: "WALK_IN",
        },
      });
      customerId = walkIn.id;
    }

    const customer = await prisma.customer.findFirst({ where: { id: customerId, tenantId } });
    if (!customer) return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    if (customer.isBlocked) {
      return NextResponse.json(
        { error: `Customer is blocked: ${customer.blockedReason ?? "contact support"}` },
        { status: 403 }
      );
    }

    const normalized = normalizeLineItems(body.items);
    const items = await applyInventoryTaxRates(normalized, { tenantId, userId });
    const { subtotal, tax, total } = computeTotals(items);

    if (customer.creditLimit > 0) {
      const credit = await serviceClient.call<{
        data: { outstanding: number; projected: number };
      }>("accounting", "/api/ar/credit-check", {
        method: "POST",
        tenantId,
        userId,
        body: { customerId, additionalAmount: total },
      });
      const projected = credit.data?.data?.projected;
      if (typeof projected === "number" && projected > customer.creditLimit) {
        return NextResponse.json(
          {
            error: `Credit limit exceeded: projected ₹${projected} > limit ₹${customer.creditLimit}`,
            code: "CREDIT_LIMIT",
          },
          { status: 403 }
        );
      }
    }

    const posResult = resolvePlaceOfSupply({
      transactionPos: body.placeOfSupply,
      buyerGstin: customer.taxId,
      buyerStateCode: customer.stateCode,
      tenantDefaultPos: profile.placeOfSupplyDefault,
    });

    if (profile.regime === TaxRegime.InGst && !posResult.ok) {
      return NextResponse.json({ error: posResult.reason }, { status: 400 });
    }

    const count = await prisma.salesOrder.count({ where: { tenantId } });
    const orderNumber = `QB-${String(count + 1).padStart(5, "0")}`;

    const order = await prisma.salesOrder.create({
      data: {
        tenantId,
        orderNumber,
        customerId,
        userId,
        date: new Date(),
        status: "CONFIRMED",
        sourceKind: "QUICK_BILL",
        placeOfSupply: posResult.ok ? posResult.stateCode : null,
        isOnlineOrder: false,
        paymentMethod: body.paymentMethod,
        subtotal,
        tax,
        total,
        items: {
          create: items.map((i) => ({
            productId: i.productId,
            productName: i.productName,
            variantId: i.variantId,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            taxRate: i.taxRate,
            taxTreatment: i.taxTreatment,
            total: i.total,
            customSnapshot: i.customSnapshot as Prisma.InputJsonValue | undefined,
          })),
        },
      },
      include: { customer: true, items: true },
    });

    let invoiceResult: unknown = null;
    if (body.issueBill) {
      const invRes = await serviceClient.call<{ data: unknown }>(
        "accounting",
        "/api/invoices/generate",
        {
          method: "POST",
          tenantId,
          userId,
          body: { salesOrderId: order.id, issue: true },
        }
      );
      if (invRes.error || invRes.status >= 400) {
        return NextResponse.json(
          { error: invRes.error ?? "Bill generation failed", order },
          { status: invRes.status || 500 }
        );
      }
      invoiceResult = invRes.data?.data;
      await prisma.salesOrder.update({
        where: { id: order.id },
        data: { status: "INVOICED" },
      });
    }

    return NextResponse.json(
      { data: { order, invoice: invoiceResult } },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Quick bill failed" },
      { status: 500 }
    );
  }
}
