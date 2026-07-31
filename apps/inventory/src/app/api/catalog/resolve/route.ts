import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveCatalogSelection } from "@/services/catalog.service";

const bodySchema = z.object({
  groupCode: z.string().min(1),
  attributes: z.record(z.string()).default({}),
});

// POST /api/catalog/resolve
export async function POST(request: Request) {
  const tenantId = request.headers.get("x-tenant-id");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });

  try {
    const body = bodySchema.parse(await request.json());
    const result = await resolveCatalogSelection(tenantId, body.groupCode, body.attributes);
    return NextResponse.json({ data: result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    console.error("catalog/resolve", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
