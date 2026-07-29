import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { resolveRequestIds, REQUEST_ID_HEADER, CORRELATION_ID_HEADER } from "@erp/logger/ids";

/** Allow the customer portal (and other local frontends) to call gateway APIs from the browser. */
function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  try {
    const u = new URL(origin);
    const localHost =
      u.hostname === "localhost" ||
      u.hostname === "127.0.0.1" ||
      /^192\.168\.\d+\.\d+$/.test(u.hostname) ||
      /^10\.\d+\.\d+\.\d+$/.test(u.hostname);
    const okPort =
      ["3007", "3010", "3000"].includes(u.port) || (u.hostname === "localhost" && u.port === "");
    return localHost && okPort;
  } catch {
    return false;
  }
}

function corsHeaders(origin: string): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, x-tenant-id, x-user-id, x-user-role, x-request-id, x-correlation-id, traceparent, tracestate, baggage",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Expose-Headers": "x-request-id, x-correlation-id, traceparent, tracestate",
    Vary: "Origin",
  };
}

export function middleware(request: NextRequest) {
  const origin = request.headers.get("origin");
  const { requestId, correlationId } = resolveRequestIds(request.headers);

  if (request.method === "OPTIONS" && isAllowedOrigin(origin)) {
    return new NextResponse(null, {
      status: 204,
      headers: {
        ...corsHeaders(origin!),
        [REQUEST_ID_HEADER]: requestId,
        [CORRELATION_ID_HEADER]: correlationId,
      },
    });
  }

  const reqHeaders = new Headers(request.headers);
  reqHeaders.set(REQUEST_ID_HEADER, requestId);
  reqHeaders.set(CORRELATION_ID_HEADER, correlationId);
  const res = NextResponse.next({ request: { headers: reqHeaders } });
  res.headers.set(REQUEST_ID_HEADER, requestId);
  res.headers.set(CORRELATION_ID_HEADER, correlationId);

  if (isAllowedOrigin(origin)) {
    for (const [k, v] of Object.entries(corsHeaders(origin!))) {
      res.headers.set(k, v);
    }
  }
  return res;
}

export const config = {
  matcher: "/api/:path*",
};
