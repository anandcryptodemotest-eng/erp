import { NextResponse } from "next/server";
import { validateDefinition } from "@/lib/workflow-platform";
import type { WorkflowDefinition } from "@erp/workflow";

/** POST /api/workflow-templates/validate — dry-run validation for designer */
export async function POST(request: Request) {
  const tenantId = request.headers.get("x-tenant-id");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });

  const body = (await request.json()) as {
    definition: WorkflowDefinition;
    previousVersion?: number;
  };
  if (!body.definition) {
    return NextResponse.json({ error: "definition required" }, { status: 400 });
  }

  const validation = validateDefinition(body.definition, body.previousVersion);
  return NextResponse.json({ validation });
}
