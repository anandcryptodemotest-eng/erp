export class Fast2SmsError extends Error {
  readonly code: string;
  readonly httpStatus: number;
  readonly clientStatus: number;

  constructor(code: string, message: string, httpStatus = 502, clientStatus = 502) {
    super(message);
    this.name = "Fast2SmsError";
    this.code = String(code);
    this.httpStatus = httpStatus;
    this.clientStatus = clientStatus;
  }
}

/** Map Fast2SMS / Meta proxy failures to safe client messages. */
export function fast2SmsErrorFromResponse(httpStatus: number, body: unknown): Fast2SmsError {
  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const nested =
    record.error && typeof record.error === "object" ? (record.error as Record<string, unknown>) : {};
  const rawCode =
    record.code ?? record.status_code ?? nested.code ?? record.return_code ?? httpStatus;
  const code = String(rawCode);
  const rawMessage =
    (typeof record.message === "string" && record.message) ||
    (typeof nested.message === "string" && nested.message) ||
    (typeof record.error === "string" && record.error) ||
    "";

  if (code === "412" || httpStatus === 401) {
    return new Fast2SmsError("412", "Invalid Fast2SMS API key", httpStatus, 401);
  }
  if (code === "413") {
    return new Fast2SmsError("413", "Fast2SMS API key is disabled", httpStatus, 403);
  }
  if (code === "416") {
    return new Fast2SmsError("416", "Insufficient Fast2SMS wallet balance", httpStatus, 402);
  }
  if (code === "424") {
    return new Fast2SmsError("424", "Invalid WhatsApp message or template id", httpStatus, 400);
  }
  if (code === "425") {
    return new Fast2SmsError("425", "Invalid or unapproved WhatsApp template", httpStatus, 400);
  }
  if (httpStatus === 429) {
    return new Fast2SmsError("429", "Fast2SMS rate limit exceeded. Try again shortly.", 429, 429);
  }

  return new Fast2SmsError(
    code || String(httpStatus),
    rawMessage || "WhatsApp provider request failed",
    httpStatus,
    502
  );
}

export function clientMessageForFast2Sms(err: unknown): { status: number; message: string } {
  if (err instanceof Fast2SmsError) {
    return { status: err.clientStatus, message: err.message };
  }
  if (err instanceof Error) {
    return { status: 502, message: err.message };
  }
  return { status: 502, message: "WhatsApp provider request failed" };
}
