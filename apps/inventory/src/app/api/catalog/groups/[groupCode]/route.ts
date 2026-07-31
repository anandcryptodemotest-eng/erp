import { NextResponse } from "next/server";
import { getCatalogGroup } from "@/services/catalog.service";

// GET /api/catalog/groups/:groupCode
export async function GET(request: Request, { params }: { params: Promise<{ groupCode: string }> }) {
  const tenantId = request.headers.get("x-tenant-id");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });

  const { groupCode } = await params;
  const group = await getCatalogGroup(tenantId, decodeURIComponent(groupCode));
  if (!group) return NextResponse.json({ error: "Group not found" }, { status: 404 });
  return NextResponse.json({ data: group });
}
