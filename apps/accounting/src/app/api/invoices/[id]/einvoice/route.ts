import { NextResponse } from "next/server";
import { z } from "zod";
import { generateIrnForInvoice, cancelIrnForInvoice } from "@/lib/nic-einvoice";
import { generateInvoice } from "@/lib/generate-invoice";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  action: z.enum(["generate", "cancel"]).default("generate"),
});

type Ctx = { params: Promise<{ id: string }> };

/** POST /api/invoices/:id/einvoice — Generate or cancel IRN (OPTIONAL manual / REQUIRED gate) */
export async function POST(request: Request, { params }: Ctx) {
  const tenantId = request.headers.get("x-tenant-id");
  const userId = request.headers.get("x-user-id") ?? undefined;
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });

  const { id } = await params;

  try {
    const body = schema.parse(await request.json().catch(() => ({})));

    if (body.action === "cancel") {
      const result = await cancelIrnForInvoice(tenantId, id);
      if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
      return NextResponse.json({ data: { cancelled: true } });
    }

    const result = await generateIrnForInvoice(tenantId, id);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

    const invoice = await prisma.invoice.findFirst({ where: { id, tenantId } });
    if (invoice?.sourceRef) {
      await generateInvoice({
        tenantId,
        userId,
        salesOrderId: invoice.sourceRef,
        force: true,
        issue: true,
      }).catch(() => undefined);
    }

    return NextResponse.json({ data: result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "E-invoice failed" },
      { status: 500 }
    );
  }
}
