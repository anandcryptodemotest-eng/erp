import { NextResponse } from "next/server";
import { z } from "zod";
import { generateInvoice } from "@/lib/generate-invoice";

const schema = z.object({
  salesOrderId: z.string().min(1),
  documentRef: z
    .object({
      type: z.literal("DOCUMENT"),
      id: z.string(),
      version: z.number().int().positive(),
    })
    .optional(),
  issue: z.boolean().optional(),
  force: z.boolean().optional(),
  payloadOverrides: z
    .array(
      z.object({
        fieldKey: z.string().min(1),
        path: z.string().min(1),
      })
    )
    .optional(),
  formValues: z.record(z.string()).optional(),
  payloadBuilder: z.string().optional(),
});

/** POST /api/invoices/generate — Accounting.generateInvoice domain command */
export async function POST(request: Request) {
  const tenantId = request.headers.get("x-tenant-id");
  const userId = request.headers.get("x-user-id") ?? undefined;
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });

  try {
    const body = schema.parse(await request.json());
    const result = await generateInvoice({
      tenantId,
      userId,
      salesOrderId: body.salesOrderId,
      documentRef: body.documentRef,
      issue: body.issue,
      force: body.force,
      payloadOverrides: body.payloadOverrides,
      formValues: body.formValues,
      payloadBuilder: body.payloadBuilder,
    });
    return NextResponse.json(
      {
        data: {
          invoice: result.invoice,
          pdfUrl: result.pdfUrl,
          checksum: result.checksum,
          created: result.created,
        },
      },
      { status: result.created ? 201 : 200 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Generate failed" },
      { status: 500 }
    );
  }
}
