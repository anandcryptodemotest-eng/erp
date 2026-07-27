import { NextResponse } from "next/server";
import { listPlatformTemplates } from "@/lib/order-workflow";

// GET /api/order-workflows/templates — platform packs (OMS Trading, Grocery, …)
export async function GET() {
  return NextResponse.json({
    data: listPlatformTemplates().map((t) => ({
      templateId: t.templateId,
      code: t.code,
      name: t.name,
      description: t.description,
      version: t.version,
      stepCount: t.steps.length,
      trackedStatuses: t.trackedStatuses,
      steps: t.steps.map((s) => ({
        key: s.key,
        label: s.label,
        action: s.action,
        fromStatuses: s.fromStatuses,
        toStatus: s.toStatus,
        uiPanel: s.uiPanel ?? "none",
      })),
    })),
  });
}
