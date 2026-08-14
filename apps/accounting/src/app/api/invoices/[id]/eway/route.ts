import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { EwayStatus } from "@erp/tax-india";
import { createHash } from "node:crypto";

const schema = z.object({
  action: z.enum(["generate", "cancel"]).default("generate"),
  vehicleNo: z.string().optional(),
  transporterName: z.string().optional(),
  distanceKm: z.number().optional(),
});

type Ctx = { params: Promise<{ id: string }> };

/** POST /api/invoices/:id/eway — generate/cancel e-way (sandbox stub) */
export async function POST(request: Request, { params }: Ctx) {
  const tenantId = request.headers.get("x-tenant-id");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });

  const { id } = await params;
  try {
    const body = schema.parse(await request.json().catch(() => ({})));
    const invoice = await prisma.invoice.findFirst({ where: { id, tenantId } });
    if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

    if (body.action === "cancel") {
      if (!invoice.ewayBillNo) {
        return NextResponse.json({ error: "No e-way bill to cancel" }, { status: 400 });
      }
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          ewayStatus: EwayStatus.Cancelled,
          ewayBillNo: null,
          ewayValidUntil: null,
        },
      });
      return NextResponse.json({ data: { cancelled: true } });
    }

    if (invoice.documentKind === "COMMERCIAL") {
      return NextResponse.json({ error: "E-way not applicable for commercial bills" }, { status: 400 });
    }

    const seed = createHash("sha256").update(`${tenantId}:${invoice.id}:eway`).digest("hex");
    const ewayBillNo = `EWB${seed.slice(0, 12).toUpperCase()}`;
    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + 1);

    const updated = await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        ewayBillNo,
        ewayValidUntil: validUntil,
        ewayStatus: EwayStatus.Success,
        notes: [
          invoice.notes,
          body.vehicleNo ? `Vehicle: ${body.vehicleNo}` : null,
          body.transporterName ? `Transporter: ${body.transporterName}` : null,
        ]
          .filter(Boolean)
          .join(" | "),
      },
    });

    return NextResponse.json({
      data: {
        ewayBillNo: updated.ewayBillNo,
        ewayValidUntil: updated.ewayValidUntil,
        ewayStatus: updated.ewayStatus,
        sandbox: true,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "E-way failed" },
      { status: 500 }
    );
  }
}
