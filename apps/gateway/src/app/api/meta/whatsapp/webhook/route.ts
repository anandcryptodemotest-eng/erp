import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

/**
 * Meta Cloud API WhatsApp webhooks.
 * Public: GET verify (hub.challenge) + POST event notifications.
 *
 * Dashboard fields:
 *   Callback URL  → https://<host>/api/meta/whatsapp/webhook
 *   Verify token  → META_WHATSAPP_VERIFY_TOKEN
 */

function verifyToken(): string {
  return (process.env.META_WHATSAPP_VERIFY_TOKEN || "").trim();
}

function appSecret(): string {
  return (process.env.META_APP_SECRET || "").trim();
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

/** GET — Meta webhook verification handshake */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  const expected = verifyToken();

  if (!expected) {
    return NextResponse.json({ error: "META_WHATSAPP_VERIFY_TOKEN not configured" }, { status: 500 });
  }
  if (mode === "subscribe" && token && challenge && safeEqual(token, expected)) {
    return new NextResponse(challenge, {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

/** POST — incoming messages + status updates (ack fast; process later) */
export async function POST(request: Request) {
  const raw = Buffer.from(await request.arrayBuffer());
  const secret = appSecret();
  if (secret) {
    const sig = request.headers.get("x-hub-signature-256") || "";
    const expected = `sha256=${createHmac("sha256", secret).update(raw).digest("hex")}`;
    if (!sig || !safeEqual(sig, expected)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  }

  let payload: unknown;
  try {
    payload = JSON.parse(raw.toString("utf8"));
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Keep response under Meta's timeout; detailed handling can be async later.
  console.info(
    "[meta-whatsapp-webhook]",
    JSON.stringify({
      at: new Date().toISOString(),
      object: (payload as { object?: string })?.object,
      entryCount: Array.isArray((payload as { entry?: unknown[] })?.entry)
        ? (payload as { entry: unknown[] }).entry.length
        : 0,
    })
  );

  return NextResponse.json({ success: true }, { status: 200 });
}
