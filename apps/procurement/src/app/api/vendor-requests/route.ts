import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildWhatsAppMessage } from "@/lib/whatsapp";
import { z } from "zod";

const createRequestSchema = z.object({
  salesOrderId: z.string().min(1),
  vendorId: z.string().optional(), // if omitted, pick preferred per product
  items: z
    .array(
      z.object({
        productId: z.string(),
        productName: z.string(),
        quantity: z.number().positive(),
        unit: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .min(1),
  sendNow: z.boolean().default(true),
  channel: z.enum(["WHATSAPP", "SMS", "EMAIL", "MANUAL"]).default("WHATSAPP"),
});

// GET /api/vendor-requests?salesOrderId=
export async function GET(request: Request) {
  const tenantId = request.headers.get("x-tenant-id");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });

  const url = new URL(request.url);
  const salesOrderId = url.searchParams.get("salesOrderId") ?? undefined;

  const data = await prisma.vendorRequest.findMany({
    where: { tenantId, ...(salesOrderId && { salesOrderId }) },
    include: {
      vendor: { select: { id: true, name: true, phone: true, whatsappNumber: true } },
      items: true,
      messages: { orderBy: { createdAt: "desc" }, take: 10 },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ data });
}

// POST /api/vendor-requests — create RFQ + optional WhatsApp queue message
export async function POST(request: Request) {
  const tenantId = request.headers.get("x-tenant-id");
  const userId = request.headers.get("x-user-id");
  if (!tenantId || !userId) return NextResponse.json({ error: "Auth context required" }, { status: 400 });

  try {
    const body = await request.json();
    const data = createRequestSchema.parse(body);

    // Resolve vendor: explicit or preferred for first product
    let vendorId = data.vendorId;
    if (!vendorId) {
      const preferred = await prisma.productVendor.findFirst({
        where: {
          tenantId,
          productId: data.items[0].productId,
          isActive: true,
        },
        orderBy: [{ isPreferred: "desc" }, { priority: "asc" }],
      });
      if (!preferred) {
        return NextResponse.json(
          { error: "No vendor mapped for product; link a vendor first" },
          { status: 400 }
        );
      }
      vendorId = preferred.vendorId;
    }

    const vendor = await prisma.vendor.findFirst({ where: { id: vendorId, tenantId } });
    if (!vendor) return NextResponse.json({ error: "Vendor not found" }, { status: 404 });

    const messageBody = buildWhatsAppMessage(data.items);

    const result = await prisma.$transaction(async (tx) => {
      const req = await tx.vendorRequest.create({
        data: {
          tenantId,
          salesOrderId: data.salesOrderId,
          vendorId: vendorId!,
          status: data.sendNow ? "SENT" : "DRAFT",
          channel: data.channel,
          messageBody,
          sentAt: data.sendNow ? new Date() : null,
          createdBy: userId,
          items: {
            create: data.items.map((i) => ({
              productId: i.productId,
              productName: i.productName,
              quantity: i.quantity,
              unit: i.unit ?? "pcs",
              notes: i.notes,
            })),
          },
        },
        include: { items: true, vendor: true },
      });

      const msg = await tx.vendorMessage.create({
        data: {
          tenantId,
          vendorId: vendorId!,
          vendorRequestId: req.id,
          direction: "OUTBOUND",
          channel: data.channel,
          body: messageBody,
          // Real WhatsApp Business API hookup later — queue as SENT for now when sendNow
          status: data.sendNow ? "SENT" : "QUEUED",
        },
      });

      return { request: req, message: msg };
    });

    const waNumber = vendor.whatsappNumber || vendor.phone;
    return NextResponse.json(
      {
        data: {
          ...result.request,
          message: result.message,
          whatsappDeepLink: waNumber
            ? `https://wa.me/${waNumber.replace(/\D/g, "")}?text=${encodeURIComponent(messageBody)}`
            : null,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
