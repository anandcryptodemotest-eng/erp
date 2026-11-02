import { NextResponse } from "next/server";
import { portalDelivery, resolvePortalTenantId } from "@/lib/portal-upstream";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/portal/orders/:id/tracking — buyer-facing delivery tracking + proof of
 * delivery for their order. Finds the DeliveryAssignment by orderId in the
 * delivery service and returns status, latest GPS ping, and POD (once delivered).
 */
export async function GET(request: Request, { params }: Ctx) {
  const tenantId = await resolvePortalTenantId(request);
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });
  const { id } = await params;

  const list = await portalDelivery<{ data?: { id: string }[] }>(
    tenantId,
    `/api/assignments?orderId=${encodeURIComponent(id)}&limit=1`
  );
  const assignment = list.json?.data?.[0];
  if (!assignment?.id) {
    // No fleet assignment yet (e.g. 3PL or not dispatched) — not an error.
    return NextResponse.json({ data: { tracked: false } });
  }

  const detail = await portalDelivery<{
    data?: {
      status: string;
      assignedAt: string;
      acceptedAt: string | null;
      pickedUpAt: string | null;
      deliveredAt: string | null;
      podPhotoUrl: string | null;
      podSignatureUrl: string | null;
      podRecipientName: string | null;
      podNotes: string | null;
      tracking?: { latitude: number; longitude: number; capturedAt: string }[];
    };
  }>(tenantId, `/api/assignments/${assignment.id}`);

  const a = detail.json?.data;
  if (!a) return NextResponse.json({ data: { tracked: false } });

  const latest = a.tracking?.[0] ?? null;
  return NextResponse.json({
    data: {
      tracked: true,
      status: a.status,
      timeline: {
        assignedAt: a.assignedAt,
        acceptedAt: a.acceptedAt,
        pickedUpAt: a.pickedUpAt,
        deliveredAt: a.deliveredAt,
      },
      lastLocation: latest
        ? { latitude: latest.latitude, longitude: latest.longitude, at: latest.capturedAt }
        : null,
      proofOfDelivery:
        a.status === "DELIVERED"
          ? {
              photoUrl: a.podPhotoUrl,
              signatureUrl: a.podSignatureUrl,
              recipientName: a.podRecipientName,
              notes: a.podNotes,
            }
          : null,
    },
  });
}
