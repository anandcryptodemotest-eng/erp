import { Fast2SmsError, fast2SmsErrorFromResponse } from "./errors";

export const FAST2SMS_BASE = "https://www.fast2sms.com";
export const DEFAULT_GRAPH_VERSION = "v24.0";

export async function parseFast2SmsBody(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { message: text.slice(0, 800) };
  }
}

export function authHeaders(apiKey: string, json = false): HeadersInit {
  return {
    Authorization: apiKey.trim(),
    ...(json ? { "Content-Type": "application/json", Accept: "application/json" } : {}),
  };
}

function isFailedPayload(body: unknown): boolean {
  if (body == null) return false;
  if (typeof body === "string") {
    const lower = body.toLowerCase();
    return lower.includes("invalid request") || lower.includes("error");
  }
  if (typeof body !== "object") return false;
  const rec = body as Record<string, unknown>;
  if (rec.error) return true;
  if (rec.return === false || rec.return === "false") return true;
  if (rec.status === false || rec.status === "false") return true;
  if (rec.success === false || rec.success === "false") return true;
  return false;
}

export async function fast2SmsRequest(
  apiKey: string,
  path: string,
  init: RequestInit & { json?: unknown } = {}
): Promise<unknown> {
  const url = path.startsWith("http") ? path : `${FAST2SMS_BASE}${path}`;
  const { json, headers, ...rest } = init;
  const res = await fetch(url, {
    ...rest,
    headers: {
      ...authHeaders(apiKey, json !== undefined || (typeof headers === "object" && Boolean((headers as Record<string, string>)["Content-Type"]))),
      ...(headers ?? {}),
    },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
    cache: "no-store",
  });
  const body = await parseFast2SmsBody(res);
  if (!res.ok) throw fast2SmsErrorFromResponse(res.status, body);
  if (isFailedPayload(body)) {
    const rec = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
    const message =
      (typeof rec.message === "string" && rec.message) ||
      (typeof rec.error === "object" && rec.error && typeof (rec.error as { message?: string }).message === "string"
        ? (rec.error as { message: string }).message
        : null) ||
      (typeof rec.error === "string" && rec.error) ||
      (typeof body === "string" && body) ||
      "Fast2SMS request failed";
    throw new Fast2SmsError("fast2sms_error", message, res.status, 502);
  }
  return body;
}

export function graphPath(version: string | undefined, ...parts: string[]): string {
  const v = version?.trim() || DEFAULT_GRAPH_VERSION;
  return `/dev/whatsapp/${encodeURIComponent(v)}/${parts.map(encodeURIComponent).join("/")}`;
}
