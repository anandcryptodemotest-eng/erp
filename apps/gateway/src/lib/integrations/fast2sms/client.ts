import { Fast2SmsError } from "./errors";
import { DEFAULT_GRAPH_VERSION, fast2SmsRequest, graphPath } from "./http";
import type {
  Fast2SmsAuthSendResponse,
  Fast2SmsHealthResponse,
  Fast2SmsListResponse,
  Fast2SmsWalletResponse,
} from "./types";

export { DEFAULT_GRAPH_VERSION };

function asRecord(body: unknown): Record<string, unknown> {
  return body && typeof body === "object" ? (body as Record<string, unknown>) : {};
}

export function extractSendIds(body: unknown): { requestId: string | null; messageId: string | null; raw: Fast2SmsAuthSendResponse } {
  const rec = asRecord(body);
  const messages = Array.isArray(rec.messages) ? rec.messages : [];
  const first = messages[0] && typeof messages[0] === "object" ? (messages[0] as { id?: string }) : {};
  const messageId = typeof first.id === "string" ? first.id : null;
  const requestId =
    (typeof rec.request_id === "string" && rec.request_id) ||
    (typeof rec.fast2sms_request_id === "string" && rec.fast2sms_request_id) ||
    messageId;
  return { requestId, messageId, raw: rec as Fast2SmsAuthSendResponse };
}

// ── Account / WABA ──────────────────────────────────────────────────────────

export async function getWabaNumbers(apiKey: string): Promise<Fast2SmsListResponse> {
  return (await fast2SmsRequest(apiKey, "/dev/dlt_manager/whatsapp?type=number")) as Fast2SmsListResponse;
}

export async function getWabaTemplates(
  apiKey: string,
  phoneNumberId?: string
): Promise<Fast2SmsListResponse> {
  const q = new URLSearchParams({ type: "template" });
  if (phoneNumberId) q.set("phone_number_id", phoneNumberId);
  return (await fast2SmsRequest(
    apiKey,
    `/dev/dlt_manager/whatsapp?${q.toString()}`
  )) as Fast2SmsListResponse;
}

export async function getPhoneNumbers(
  apiKey: string,
  wabaId: string,
  version?: string,
  fields?: string,
  filtering?: string
) {
  const q = new URLSearchParams();
  if (fields) q.set("fields", fields);
  if (filtering) q.set("filtering", filtering);
  const suffix = q.toString() ? `?${q}` : "";
  return fast2SmsRequest(apiKey, `${graphPath(version, wabaId, "phone_numbers")}${suffix}`);
}

export async function getPhoneNumberDetails(
  apiKey: string,
  phoneNumberId: string,
  version?: string,
  fields = "status,is_official_business_account,id,name_status,code_verification_status,display_phone_number,platform_type,messaging_limit_tier,throughput"
) {
  return fast2SmsRequest(
    apiKey,
    `${graphPath(version, phoneNumberId)}?fields=${encodeURIComponent(fields)}`
  );
}

export async function getDisplayNameStatus(apiKey: string, phoneNumberId: string, version?: string) {
  return getPhoneNumberDetails(apiKey, phoneNumberId, version, "name_status");
}

export async function getBusinessProfile(
  apiKey: string,
  phoneNumberId: string,
  version?: string,
  fields = "about,address,description,email,profile_picture_url,websites,vertical"
) {
  return fast2SmsRequest(
    apiKey,
    `${graphPath(version, phoneNumberId, "whatsapp_business_profile")}?fields=${encodeURIComponent(fields)}`
  );
}

export async function updateBusinessProfile(
  apiKey: string,
  phoneNumberId: string,
  payload: Record<string, unknown>,
  version?: string
) {
  return fast2SmsRequest(apiKey, graphPath(version, phoneNumberId, "whatsapp_business_profile"), {
    method: "POST",
    json: { messaging_product: "whatsapp", ...payload },
  });
}

export async function getWabaHealth(
  apiKey: string,
  wabaId: string,
  graphVersion = DEFAULT_GRAPH_VERSION
): Promise<Fast2SmsHealthResponse> {
  return (await fast2SmsRequest(
    apiKey,
    `${graphPath(graphVersion, wabaId)}?fields=health_status`
  )) as Fast2SmsHealthResponse;
}

export async function getWallet(apiKey: string): Promise<Fast2SmsWalletResponse> {
  return (await fast2SmsRequest(apiKey, "/dev/wallet", {
    method: "POST",
    json: {},
  })) as Fast2SmsWalletResponse;
}

// ── Template CRUD (Meta proxy) ──────────────────────────────────────────────

/** https://docs.fast2sms.com/reference/createcopycodetemplate */
export function copyCodeTemplatePayload(name: string, language = "en_US") {
  return {
    name,
    language,
    category: "authentication",
    components: [
      { type: "BODY", add_security_recommendation: true },
      { type: "FOOTER", code_expiration_minutes: 10 },
      {
        type: "BUTTONS",
        buttons: [{ type: "OTP", otp_type: "COPY_CODE", text: "Copy Code" }],
      },
    ],
  };
}

export async function createCopyCodeTemplate(
  apiKey: string,
  wabaId: string,
  input: { name: string; language?: string; graphVersion?: string }
) {
  return fast2SmsRequest(apiKey, graphPath(input.graphVersion, wabaId, "message_templates"), {
    method: "POST",
    json: copyCodeTemplatePayload(input.name, input.language || "en_US"),
  });
}

export async function createOneTapTemplate(
  apiKey: string,
  wabaId: string,
  input: {
    name: string;
    language?: string;
    graphVersion?: string;
    packageName: string;
    signatureHash: string;
  }
) {
  return fast2SmsRequest(apiKey, graphPath(input.graphVersion, wabaId, "message_templates"), {
    method: "POST",
    json: {
      name: input.name,
      language: input.language || "en_US",
      category: "authentication",
      components: [
        { type: "body", add_security_recommendation: true },
        { type: "footer", code_expiration_minutes: 10 },
        {
          type: "buttons",
          buttons: [
            {
              type: "otp",
              otp_type: "one_tap",
              text: "Copy Code",
              autofill_text: "Autofill",
              supported_apps: [
                { package_name: input.packageName, signature_hash: input.signatureHash },
              ],
            },
          ],
        },
      ],
    },
  });
}

export async function createZeroTapTemplate(
  apiKey: string,
  wabaId: string,
  input: {
    name: string;
    language?: string;
    graphVersion?: string;
    packageName: string;
    signatureHash: string;
  }
) {
  return fast2SmsRequest(apiKey, graphPath(input.graphVersion, wabaId, "message_templates"), {
    method: "POST",
    json: {
      name: input.name,
      language: input.language || "en_US",
      category: "authentication",
      components: [
        { type: "body", add_security_recommendation: true },
        { type: "footer", code_expiration_minutes: 10 },
        {
          type: "buttons",
          buttons: [
            {
              type: "otp",
              otp_type: "zero_tap",
              zero_tap_terms_accepted: true,
              text: "Copy Code",
              autofill_text: "Autofill",
              supported_apps: [
                { package_name: input.packageName, signature_hash: input.signatureHash },
              ],
            },
          ],
        },
      ],
    },
  });
}

export async function createTextTemplate(
  apiKey: string,
  wabaId: string,
  input: {
    name: string;
    language?: string;
    category?: "UTILITY" | "MARKETING" | "AUTHENTICATION";
    body: string;
    example?: string[];
    graphVersion?: string;
  }
) {
  const exampleValues = input.example?.length ? input.example : ["there"];
  return fast2SmsRequest(apiKey, graphPath(input.graphVersion, wabaId, "message_templates"), {
    method: "POST",
    json: {
      name: input.name,
      language: input.language || "en",
      category: input.category || "UTILITY",
      components: [
        {
          type: "BODY",
          text: input.body,
          example: { body_text: [exampleValues] },
        },
      ],
    },
  });
}

export async function createMessageTemplate(
  apiKey: string,
  wabaId: string,
  payload: Record<string, unknown>,
  graphVersion?: string
) {
  return fast2SmsRequest(apiKey, graphPath(graphVersion, wabaId, "message_templates"), {
    method: "POST",
    json: payload,
  });
}

export async function listMessageTemplates(
  apiKey: string,
  wabaId: string,
  input: { limit?: number; after?: string; before?: string; name?: string; graphVersion?: string } = {}
) {
  const q = new URLSearchParams();
  if (input.limit) q.set("limit", String(input.limit));
  if (input.after) q.set("after", input.after);
  if (input.before) q.set("before", input.before);
  if (input.name) q.set("name", input.name);
  const suffix = q.toString() ? `?${q}` : "";
  return fast2SmsRequest(apiKey, `${graphPath(input.graphVersion, wabaId, "message_templates")}${suffix}`);
}

export async function getTemplateById(apiKey: string, templateId: string, graphVersion?: string) {
  return fast2SmsRequest(apiKey, graphPath(graphVersion, templateId));
}

export async function editTemplate(
  apiKey: string,
  templateId: string,
  payload: Record<string, unknown>,
  graphVersion?: string
) {
  return fast2SmsRequest(apiKey, graphPath(graphVersion, templateId), { method: "POST", json: payload });
}

export async function deleteTemplate(
  apiKey: string,
  wabaId: string,
  input: { name?: string; hsmId?: string; graphVersion?: string }
) {
  const q = new URLSearchParams();
  if (input.name) q.set("name", input.name);
  if (input.hsmId) q.set("hsm_id", input.hsmId);
  return fast2SmsRequest(apiKey, `${graphPath(input.graphVersion, wabaId, "message_templates")}?${q}`, {
    method: "DELETE",
  });
}

// ── Send ────────────────────────────────────────────────────────────────────

/** Simple Fast2SMS template send. https://docs.fast2sms.com/reference/sendwhatsappmessage */
export async function sendTemplateSimple(input: {
  apiKey: string;
  messageId: string | number;
  phoneNumberId: string;
  numbers: string;
  variablesValues?: string;
  mediaUrl?: string;
  documentFilename?: string;
  udf1?: string;
  udf2?: string;
  udf3?: string;
}): Promise<{ requestId: string | null; messageId: string | null; raw: Fast2SmsAuthSendResponse }> {
  const q = new URLSearchParams({
    message_id: String(input.messageId),
    phone_number_id: input.phoneNumberId,
    numbers: input.numbers,
  });
  if (input.variablesValues) q.set("variables_values", input.variablesValues);
  if (input.mediaUrl) q.set("media_url", input.mediaUrl);
  if (input.documentFilename) q.set("document_filename", input.documentFilename);
  if (input.udf1) q.set("udf1", input.udf1);
  if (input.udf2) q.set("udf2", input.udf2);
  if (input.udf3) q.set("udf3", input.udf3);
  const body = await fast2SmsRequest(input.apiKey, `/dev/whatsapp?${q.toString()}`);
  return extractSendIds(body);
}

export async function sendAuthenticationTemplate(input: {
  apiKey: string;
  phoneNumberId: string;
  to: string;
  templateName: string;
  language: string;
  otp: string;
  graphVersion?: string;
}): Promise<{ requestId: string | null; messageId: string | null; raw: Fast2SmsAuthSendResponse }> {
  const body = await fast2SmsRequest(
    input.apiKey,
    graphPath(input.graphVersion, input.phoneNumberId, "messages"),
    {
      method: "POST",
      json: {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: input.to,
        type: "template",
        template: {
          name: input.templateName,
          language: { code: input.language },
          components: [
            { type: "body", parameters: [{ type: "text", text: input.otp }] },
            {
              type: "button",
              sub_type: "url",
              index: "0",
              parameters: [{ type: "text", text: input.otp }],
            },
          ],
        },
      },
    }
  );
  return extractSendIds(body);
}

export async function sendMetaMessage(
  apiKey: string,
  phoneNumberId: string,
  payload: Record<string, unknown>,
  graphVersion?: string
) {
  const body = await fast2SmsRequest(apiKey, graphPath(graphVersion, phoneNumberId, "messages"), {
    method: "POST",
    json: payload,
  });
  return extractSendIds(body);
}

export async function sendSessionSimple(input: {
  apiKey: string;
  phoneNumberId: string;
  to: string;
  payload: Record<string, unknown>;
}): Promise<{ requestId: string | null; messageId: string | null; raw: Fast2SmsAuthSendResponse }> {
  const q = new URLSearchParams({
    phone_number_id: input.phoneNumberId,
    to: input.to,
  });
  const body = await fast2SmsRequest(input.apiKey, `/dev/whatsapp-session?${q.toString()}`, {
    method: "POST",
    json: input.payload,
  });
  return extractSendIds(body);
}

// ── Media / QR / block ──────────────────────────────────────────────────────

export async function uploadMedia(
  apiKey: string,
  phoneNumberId: string,
  form: FormData,
  graphVersion?: string
) {
  return fast2SmsRequest(apiKey, graphPath(graphVersion, phoneNumberId, "media"), {
    method: "POST",
    body: form,
    headers: { Authorization: apiKey },
  });
}

export async function createMediaHandle(
  apiKey: string,
  phoneNumberId: string,
  form: FormData,
  graphVersion?: string
) {
  return fast2SmsRequest(apiKey, graphPath(graphVersion, phoneNumberId, "media_handle"), {
    method: "POST",
    body: form,
    headers: { Authorization: apiKey },
  });
}

export async function getMediaUrl(
  apiKey: string,
  phoneNumberId: string,
  mediaId: string,
  graphVersion?: string
) {
  return fast2SmsRequest(apiKey, graphPath(graphVersion, phoneNumberId, "media", mediaId));
}

export async function listQrCodes(apiKey: string, phoneNumberId: string, graphVersion?: string) {
  return fast2SmsRequest(apiKey, graphPath(graphVersion, phoneNumberId, "message_qrdls"));
}

export async function createQrCode(
  apiKey: string,
  phoneNumberId: string,
  prefilledMessage: string,
  graphVersion?: string
) {
  return fast2SmsRequest(apiKey, graphPath(graphVersion, phoneNumberId, "message_qrdls"), {
    method: "POST",
    json: { prefilled_message: prefilledMessage, generate_qr_image: "SVG" },
  });
}

export async function updateQrCode(
  apiKey: string,
  phoneNumberId: string,
  qrId: string,
  prefilledMessage: string,
  graphVersion?: string
) {
  return fast2SmsRequest(apiKey, graphPath(graphVersion, phoneNumberId, "message_qrdls", qrId), {
    method: "POST",
    json: { prefilled_message: prefilledMessage },
  });
}

export async function deleteQrCode(
  apiKey: string,
  phoneNumberId: string,
  qrId: string,
  graphVersion?: string
) {
  return fast2SmsRequest(apiKey, graphPath(graphVersion, phoneNumberId, "message_qrdls", qrId), {
    method: "DELETE",
  });
}

export async function getBlockedUsers(apiKey: string, phoneNumberId: string, graphVersion?: string) {
  return fast2SmsRequest(apiKey, graphPath(graphVersion, phoneNumberId, "block_users"));
}

export async function blockUsers(
  apiKey: string,
  phoneNumberId: string,
  users: string[],
  graphVersion?: string
) {
  return fast2SmsRequest(apiKey, graphPath(graphVersion, phoneNumberId, "block_users"), {
    method: "POST",
    json: { messaging_product: "whatsapp", block_users: users.map((u) => ({ user: u })) },
  });
}

export async function unblockUsers(
  apiKey: string,
  phoneNumberId: string,
  users: string[],
  graphVersion?: string
) {
  return fast2SmsRequest(apiKey, graphPath(graphVersion, phoneNumberId, "block_users"), {
    method: "DELETE",
    json: { messaging_product: "whatsapp", block_users: users.map((u) => ({ user: u })) },
  });
}

// ── Reports / logs / webhooks ───────────────────────────────────────────────

export async function fetchDeliveryReport(apiKey: string, requestId: string) {
  return fast2SmsRequest(apiKey, `/dev/whatsapp/${encodeURIComponent(requestId)}`);
}

export async function getWhatsAppLogs(apiKey: string, from: string, to: string) {
  const q = new URLSearchParams({ from, to });
  return fast2SmsRequest(apiKey, `/dev/whatsapp_logs?${q}`);
}

export async function getWhatsAppSummary(apiKey: string, from: string, to: string) {
  const q = new URLSearchParams({ from, to });
  return fast2SmsRequest(apiKey, `/dev/whatsapp_summary?${q}`);
}

export async function listWhatsAppWebhooks(apiKey: string) {
  return fast2SmsRequest(apiKey, "/dev/webhook/v2/whatsapp");
}

export async function createWhatsAppWebhook(apiKey: string, payload: Record<string, unknown>) {
  return fast2SmsRequest(apiKey, "/dev/webhook/v2/whatsapp", { method: "POST", json: payload });
}

export async function updateWhatsAppWebhook(
  apiKey: string,
  id: string,
  payload: Record<string, unknown>
) {
  return fast2SmsRequest(apiKey, `/dev/webhook/v2/whatsapp/${encodeURIComponent(id)}`, {
    method: "PUT",
    json: payload,
  });
}

export async function deleteWhatsAppWebhook(apiKey: string, id: string) {
  return fast2SmsRequest(apiKey, `/dev/webhook/v2/whatsapp/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

// ── SMS OTP + DLT ───────────────────────────────────────────────────────────

export async function sendSmsOtp(input: {
  apiKey: string;
  mobile: string;
  otpId: string;
  otp?: string;
  otpLength?: number;
  otpExpiry?: number;
  variablesValues?: string;
  udf1?: string;
}) {
  const body = await fast2SmsRequest(input.apiKey, "/dev/otp/send", {
    method: "POST",
    json: {
      mobile: input.mobile,
      otp_id: input.otpId,
      ...(input.otp ? { otp: input.otp } : {}),
      otp_length: input.otpLength ?? 6,
      otp_expiry: input.otpExpiry ?? 5,
      ...(input.variablesValues ? { variables_values: input.variablesValues } : {}),
      ...(input.udf1 ? { udf1: input.udf1 } : {}),
    },
  });
  return extractSendIds(body);
}

export async function verifySmsOtp(apiKey: string, mobile: string, otp: string) {
  return fast2SmsRequest(apiKey, "/dev/otp/verify", {
    method: "POST",
    json: { mobile, otp },
  });
}

export async function resendSmsOtp(apiKey: string, mobile: string) {
  return fast2SmsRequest(apiKey, "/dev/otp/resend", {
    method: "POST",
    json: { mobile },
  });
}

export async function sendDltSms(input: {
  apiKey: string;
  senderId: string;
  messageId: string;
  numbers: string;
  variablesValues?: string;
  route?: string;
}) {
  const q = new URLSearchParams({
    sender_id: input.senderId,
    message: input.messageId,
    numbers: input.numbers,
    route: input.route || "dlt",
  });
  if (input.variablesValues) q.set("variables_values", input.variablesValues);
  return fast2SmsRequest(input.apiKey, `/dev/bulkV2?${q}`);
}

export async function sendQuickSms(input: {
  apiKey: string;
  message: string;
  numbers: string;
}) {
  const q = new URLSearchParams({
    route: "q",
    message: input.message,
    numbers: input.numbers,
  });
  return fast2SmsRequest(input.apiKey, `/dev/bulkV2?${q}`);
}

export async function getSmsLogs(apiKey: string, from: string, to: string) {
  const q = new URLSearchParams({ from, to });
  return fast2SmsRequest(apiKey, `/dev/sms_logs?${q.toString()}`);
}

// ── Helpers ─────────────────────────────────────────────────────────────────

export function isApprovedAuthTemplate(input: {
  category?: string;
  status?: string;
  var_count?: number;
}): boolean {
  const category = (input.category ?? "").toUpperCase();
  const status = (input.status ?? "").toUpperCase();
  const vars = Number(input.var_count ?? 0);
  const approved = status === "APPROVED" || status === "";
  return category === "AUTHENTICATION" && approved && vars >= 1;
}

export function isUsableSimpleTemplate(input: {
  status?: string;
  var_count?: number;
  message_id?: string | number;
}): boolean {
  const status = (input.status ?? "").toUpperCase();
  const approved = status === "APPROVED" || status === "";
  return approved && Boolean(input.message_id);
}

export function assertSendOk(raw: Fast2SmsAuthSendResponse) {
  if (raw.status === false || raw.status === "false" || raw.return === false) {
    const msg = Array.isArray(raw.message) ? raw.message.join(", ") : raw.message;
    throw new Fast2SmsError("send_failed", msg || "WhatsApp send failed", 502, 502);
  }
}
