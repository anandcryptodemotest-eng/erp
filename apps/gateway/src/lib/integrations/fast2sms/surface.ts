import { fast2SmsRequest, graphPath } from "./http";
import { sendMetaMessage } from "./client";

// ── Extra Meta template creates (same POST /message_templates) ───────────────
// https://docs.fast2sms.com/reference/createcopycodetemplate and siblings

export async function createMediaTemplate(
  apiKey: string,
  wabaId: string,
  input: {
    name: string;
    language?: string;
    category?: "UTILITY" | "MARKETING";
    headerFormat: "IMAGE" | "VIDEO" | "DOCUMENT";
    headerHandle: string;
    body: string;
    example?: string[];
    graphVersion?: string;
  }
) {
  return fast2SmsRequest(apiKey, graphPath(input.graphVersion, wabaId, "message_templates"), {
    method: "POST",
    json: {
      name: input.name,
      language: input.language || "en",
      category: input.category || "UTILITY",
      components: [
        {
          type: "HEADER",
          format: input.headerFormat,
          example: { header_handle: [input.headerHandle] },
        },
        {
          type: "BODY",
          text: input.body,
          example: { body_text: [input.example?.length ? input.example : ["Name"]] },
        },
      ],
    },
  });
}

export async function createLocationTemplate(
  apiKey: string,
  wabaId: string,
  input: {
    name: string;
    language?: string;
    category?: "UTILITY" | "MARKETING";
    body: string;
    example?: string[];
    graphVersion?: string;
  }
) {
  return fast2SmsRequest(apiKey, graphPath(input.graphVersion, wabaId, "message_templates"), {
    method: "POST",
    json: {
      name: input.name,
      language: input.language || "en",
      category: input.category || "MARKETING",
      components: [
        { type: "HEADER", format: "LOCATION" },
        {
          type: "BODY",
          text: input.body,
          example: { body_text: [input.example?.length ? input.example : ["Name"]] },
        },
      ],
    },
  });
}

export async function createCatalogTemplate(
  apiKey: string,
  wabaId: string,
  input: {
    name: string;
    language?: string;
    body: string;
    example: string[];
    footer?: string;
    buttonText?: string;
    graphVersion?: string;
  }
) {
  return fast2SmsRequest(apiKey, graphPath(input.graphVersion, wabaId, "message_templates"), {
    method: "POST",
    json: {
      name: input.name,
      language: input.language || "en",
      category: "MARKETING",
      components: [
        { type: "BODY", text: input.body, example: { body_text: [input.example] } },
        ...(input.footer ? [{ type: "FOOTER", text: input.footer }] : []),
        { type: "BUTTONS", buttons: [{ type: "CATALOG", text: input.buttonText || "View catalog" }] },
      ],
    },
  });
}

export async function createCouponCodeTemplate(
  apiKey: string,
  wabaId: string,
  input: {
    name: string;
    language?: string;
    header?: string;
    body: string;
    example: string[];
    couponExample: string;
    graphVersion?: string;
  }
) {
  return fast2SmsRequest(apiKey, graphPath(input.graphVersion, wabaId, "message_templates"), {
    method: "POST",
    json: {
      name: input.name,
      language: input.language || "en",
      category: "MARKETING",
      components: [
        ...(input.header ? [{ type: "HEADER", format: "TEXT", text: input.header }] : []),
        { type: "BODY", text: input.body, example: { body_text: [input.example] } },
        {
          type: "BUTTONS",
          buttons: [{ type: "COPY_CODE", example: input.couponExample }],
        },
      ],
    },
  });
}

export async function createCtaTemplate(
  apiKey: string,
  wabaId: string,
  input: {
    name: string;
    language?: string;
    category?: "UTILITY" | "MARKETING";
    body: string;
    example?: string[];
    buttons: { text: string; url: string; example?: string }[];
    graphVersion?: string;
  }
) {
  return fast2SmsRequest(apiKey, graphPath(input.graphVersion, wabaId, "message_templates"), {
    method: "POST",
    json: {
      name: input.name,
      language: input.language || "en",
      category: input.category || "MARKETING",
      components: [
        {
          type: "BODY",
          text: input.body,
          example: { body_text: [input.example?.length ? input.example : ["there"]] },
        },
        {
          type: "BUTTONS",
          buttons: input.buttons.map((b) => ({
            type: "URL",
            text: b.text,
            url: b.url,
            ...(b.example ? { example: b.example } : {}),
          })),
        },
      ],
    },
  });
}

export async function createFlowsTemplate(
  apiKey: string,
  wabaId: string,
  input: {
    name: string;
    language?: string;
    body: string;
    flowId: string;
    buttonText?: string;
    navigateScreen?: string;
    graphVersion?: string;
  }
) {
  return fast2SmsRequest(apiKey, graphPath(input.graphVersion, wabaId, "message_templates"), {
    method: "POST",
    json: {
      name: input.name,
      language: input.language || "en_US",
      category: "MARKETING",
      components: [
        { type: "BODY", text: input.body },
        {
          type: "BUTTONS",
          buttons: [
            {
              type: "FLOW",
              text: input.buttonText || "Open flow",
              flow_id: input.flowId,
              navigate_screen: input.navigateScreen,
              flow_action: "navigate",
            },
          ],
        },
      ],
    },
  });
}

// ── Extra Meta template sends ────────────────────────────────────────────────

function templateEnvelope(
  to: string,
  name: string,
  language: string,
  components?: unknown[]
) {
  return {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "template",
    template: {
      name,
      language: { code: language },
      ...(components?.length ? { components } : {}),
    },
  };
}

export async function sendTextTemplate(input: {
  apiKey: string;
  phoneNumberId: string;
  to: string;
  templateName: string;
  language?: string;
  graphVersion?: string;
}) {
  return sendMetaMessage(
    input.apiKey,
    input.phoneNumberId,
    templateEnvelope(input.to, input.templateName, input.language || "en"),
    input.graphVersion
  );
}

export async function sendTemplateWithVariables(input: {
  apiKey: string;
  phoneNumberId: string;
  to: string;
  templateName: string;
  language?: string;
  bodyValues: string[];
  graphVersion?: string;
}) {
  return sendMetaMessage(
    input.apiKey,
    input.phoneNumberId,
    templateEnvelope(input.to, input.templateName, input.language || "en", [
      { type: "body", parameters: input.bodyValues.map((text) => ({ type: "text", text })) },
    ]),
    input.graphVersion
  );
}

export async function sendCouponCodeMessage(input: {
  apiKey: string;
  phoneNumberId: string;
  to: string;
  templateName: string;
  language?: string;
  bodyValues: string[];
  couponCode: string;
  buttonIndex?: string;
  graphVersion?: string;
}) {
  return sendMetaMessage(
    input.apiKey,
    input.phoneNumberId,
    templateEnvelope(input.to, input.templateName, input.language || "en", [
      { type: "body", parameters: input.bodyValues.map((text) => ({ type: "text", text })) },
      {
        type: "button",
        sub_type: "COPY_CODE",
        index: input.buttonIndex ?? "0",
        parameters: [{ type: "coupon_code", coupon_code: input.couponCode }],
      },
    ]),
    input.graphVersion
  );
}

export async function sendCtaTemplate(input: {
  apiKey: string;
  phoneNumberId: string;
  to: string;
  templateName: string;
  language?: string;
  urlPayload: string;
  buttonIndex?: string;
  graphVersion?: string;
}) {
  return sendMetaMessage(
    input.apiKey,
    input.phoneNumberId,
    templateEnvelope(input.to, input.templateName, input.language || "en", [
      {
        type: "button",
        sub_type: "url",
        index: input.buttonIndex ?? "0",
        parameters: [{ type: "text", text: input.urlPayload }],
      },
    ]),
    input.graphVersion
  );
}

export async function sendLocationTemplate(input: {
  apiKey: string;
  phoneNumberId: string;
  to: string;
  templateName: string;
  language?: string;
  latitude: number;
  longitude: number;
  name: string;
  address: string;
  bodyValues?: string[];
  graphVersion?: string;
}) {
  return sendMetaMessage(
    input.apiKey,
    input.phoneNumberId,
    templateEnvelope(input.to, input.templateName, input.language || "en", [
      {
        type: "header",
        parameters: [
          {
            type: "location",
            location: {
              latitude: input.latitude,
              longitude: input.longitude,
              name: input.name,
              address: input.address,
            },
          },
        ],
      },
      ...(input.bodyValues?.length
        ? [{ type: "body", parameters: input.bodyValues.map((text) => ({ type: "text", text })) }]
        : []),
    ]),
    input.graphVersion
  );
}

export async function sendFlowsTemplate(input: {
  apiKey: string;
  phoneNumberId: string;
  to: string;
  templateName: string;
  language?: string;
  flowToken?: string;
  flowActionData?: Record<string, unknown>;
  graphVersion?: string;
}) {
  return sendMetaMessage(
    input.apiKey,
    input.phoneNumberId,
    templateEnvelope(input.to, input.templateName, input.language || "en_US", [
      {
        type: "button",
        sub_type: "flow",
        index: "0",
        parameters: [
          {
            type: "action",
            action: {
              ...(input.flowToken ? { flow_token: input.flowToken } : {}),
              ...(input.flowActionData ? { flow_action_data: input.flowActionData } : {}),
            },
          },
        ],
      },
    ]),
    input.graphVersion
  );
}

// ── DLT Manager ──────────────────────────────────────────────────────────────
// https://docs.fast2sms.com/reference/dlt-manager.md

export async function listDlt(apiKey: string, type: "sender" | "template" = "sender") {
  return fast2SmsRequest(apiKey, `/dev/dlt_manager?type=${encodeURIComponent(type)}`);
}

export async function addDltEntity(
  apiKey: string,
  input: { entityId: string; entityName: string; screenshot: string[] }
) {
  return fast2SmsRequest(apiKey, "/dev/dlt_manager/add_entity", {
    method: "POST",
    json: {
      entity_id: input.entityId,
      entity_name: input.entityName,
      screenshot: input.screenshot,
    },
  });
}

export async function addDltSenderId(apiKey: string, payload: Record<string, unknown>) {
  return fast2SmsRequest(apiKey, "/dev/dlt_manager/add_sender", { method: "POST", json: payload });
}

export async function addDltContentTemplate(apiKey: string, payload: Record<string, unknown>) {
  return fast2SmsRequest(apiKey, "/dev/dlt_manager/add_template", { method: "POST", json: payload });
}

// ── SMS reports + webhooks ───────────────────────────────────────────────────

export async function fetchSmsDeliveryReport(apiKey: string, requestId: string) {
  return fast2SmsRequest(apiKey, `/dev/report?request_id=${encodeURIComponent(requestId)}`);
}

export async function getSmsLogsSummary(apiKey: string, from: string, to: string) {
  const q = new URLSearchParams({ from, to });
  return fast2SmsRequest(apiKey, `/dev/sms_summary?${q}`);
}

type WebhookChannel = "whatsapp" | "sms" | "otp" | "rcs";

function webhookPath(channel: WebhookChannel, id?: string) {
  const base = `/dev/webhook/v2/${channel}`;
  return id ? `${base}/${encodeURIComponent(id)}` : base;
}

export async function listWebhooks(apiKey: string, channel: WebhookChannel = "whatsapp") {
  return fast2SmsRequest(apiKey, webhookPath(channel));
}

export async function createWebhook(
  apiKey: string,
  channel: WebhookChannel,
  payload: Record<string, unknown>
) {
  return fast2SmsRequest(apiKey, webhookPath(channel), { method: "POST", json: payload });
}

export async function updateWebhook(
  apiKey: string,
  channel: WebhookChannel,
  id: string,
  payload: Record<string, unknown>
) {
  return fast2SmsRequest(apiKey, webhookPath(channel, id), { method: "PUT", json: payload });
}

export async function deleteWebhook(apiKey: string, channel: WebhookChannel, id: string) {
  return fast2SmsRequest(apiKey, webhookPath(channel, id), { method: "DELETE" });
}
