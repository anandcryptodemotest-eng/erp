import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma";
import { decryptSecret, encryptSecret, lastFourOfSecret } from "./crypto";
import {
  DEFAULT_GRAPH_VERSION,
  createCopyCodeTemplate,
  createMessageTemplate,
  createTextTemplate,
  createWebhook,
  deleteWebhook,
  fetchDeliveryReport,
  fetchSmsDeliveryReport,
  getBusinessProfile,
  getPhoneNumberDetails,
  getSmsLogs,
  getSmsLogsSummary,
  getWabaHealth,
  getWabaNumbers,
  getWabaTemplates,
  getWallet,
  getWhatsAppLogs,
  getWhatsAppSummary,
  isApprovedAuthTemplate,
  isUsableSimpleTemplate,
  listDlt,
  listMessageTemplates,
  listWebhooks,
  sendAuthenticationTemplate,
  sendSessionSimple,
  sendSmsOtp,
  sendTemplateSimple,
  updateWebhook,
} from "./fast2sms";
import type {
  Fast2SmsMetaTemplate,
  Fast2SmsTemplate,
  Fast2SmsWabaNumber,
  OtpSendChannel,
  WhatsAppIntegrationConfig,
} from "./fast2sms/types";

export const FAST2SMS_PROVIDER = "FAST2SMS_WHATSAPP";
export const API_KEY_NAME = "api_key";

export class WhatsAppNotConfiguredError extends Error {
  constructor(message = "WhatsApp OTP is not configured for this organization") {
    super(message);
    this.name = "WhatsAppNotConfiguredError";
  }
}

export type WhatsAppStatusDto = {
  status: string;
  lastError: string | null;
  lastSyncedAt: string | null;
  apiKeyLastFour: string | null;
  hasApiKey: boolean;
  config: {
    wabaId: string | null;
    phoneNumberId: string | null;
    displayPhone: string | null;
    verifiedName: string | null;
    qualityRating: string | null;
    connectionStatus: string | null;
    authTemplateName: string | null;
    authTemplateLanguage: string | null;
    authMessageId: string | null;
    pendingAuthTemplateName: string | null;
    pendingAuthTemplateStatus: string | null;
    graphVersion: string;
    smsOtpId: string | null;
    smsSenderId: string | null;
    dltMessageId: string | null;
  };
  numbers: Fast2SmsWabaNumber[];
  templates: Fast2SmsTemplate[];
  authTemplates: Fast2SmsTemplate[];
  metaTemplates: Fast2SmsMetaTemplate[];
  health: WhatsAppIntegrationConfig["health"];
  wallet: WhatsAppIntegrationConfig["wallet"];
  profile: unknown;
  phoneDetails: unknown;
  readyForOtp: boolean;
  otpChannel: OtpSendChannel | null;
};

function asConfig(raw: unknown): WhatsAppIntegrationConfig {
  if (!raw || typeof raw !== "object") return {};
  return raw as WhatsAppIntegrationConfig;
}

function str(value: unknown): string {
  if (value == null) return "";
  return String(value);
}

export async function loadApiKey(tenantId: string): Promise<string | null> {
  const row = await prisma.tenantIntegrationSecret.findUnique({
    where: {
      tenantId_provider_keyName: {
        tenantId,
        provider: FAST2SMS_PROVIDER,
        keyName: API_KEY_NAME,
      },
    },
  });
  if (!row) return null;
  return decryptSecret({ ciphertext: row.ciphertext, iv: row.iv, authTag: row.authTag });
}

export async function getIntegrationRow(tenantId: string) {
  return prisma.tenantIntegration.findUnique({
    where: { tenantId_provider: { tenantId, provider: FAST2SMS_PROVIDER } },
  });
}

export async function getWhatsAppStatus(tenantId: string): Promise<WhatsAppStatusDto> {
  const [integration, secret] = await Promise.all([
    getIntegrationRow(tenantId),
    prisma.tenantIntegrationSecret.findUnique({
      where: {
        tenantId_provider_keyName: {
          tenantId,
          provider: FAST2SMS_PROVIDER,
          keyName: API_KEY_NAME,
        },
      },
      select: { lastFour: true },
    }),
  ]);
  const config = asConfig(integration?.config);
  const templates = config.templates ?? [];
  const authTemplates = templates.filter(isApprovedAuthTemplate);
  const phoneNumberId = config.phoneNumberId ?? null;
  const authTemplateName = config.authTemplateName ?? null;
  const authMessageId = config.authMessageId ?? null;
  const smsOtpId = config.smsOtpId ?? null;
  const pendingUnapproved =
    Boolean(config.pendingAuthTemplateName) &&
    config.pendingAuthTemplateName === authTemplateName &&
    Boolean(config.pendingAuthTemplateStatus) &&
    !["APPROVED", "ACTIVE", ""].includes(String(config.pendingAuthTemplateStatus).toUpperCase());
  let otpChannel: OtpSendChannel | null = null;
  if (integration?.status === "CONNECTED" && secret?.lastFour) {
    if (phoneNumberId && authTemplateName && !pendingUnapproved) otpChannel = "whatsapp_auth";
    else if (phoneNumberId && authMessageId) otpChannel = "whatsapp_simple";
    else if (smsOtpId) otpChannel = "sms_otp";
  }
  const readyForOtp = Boolean(otpChannel);

  return {
    status: integration?.status ?? "DISCONNECTED",
    lastError: integration?.lastError ?? null,
    lastSyncedAt: integration?.lastSyncedAt?.toISOString() ?? null,
    apiKeyLastFour: secret?.lastFour ?? null,
    hasApiKey: Boolean(secret?.lastFour),
    config: {
      wabaId: config.wabaId ?? null,
      phoneNumberId,
      displayPhone: config.displayPhone ?? null,
      verifiedName: config.verifiedName ?? null,
      qualityRating: config.qualityRating ?? null,
      connectionStatus: config.connectionStatus ?? null,
      authTemplateName,
      authTemplateLanguage: config.authTemplateLanguage ?? null,
      authMessageId,
      pendingAuthTemplateName: config.pendingAuthTemplateName ?? null,
      pendingAuthTemplateStatus: config.pendingAuthTemplateStatus ?? null,
      graphVersion: config.graphVersion || DEFAULT_GRAPH_VERSION,
      smsOtpId,
      smsSenderId: config.smsSenderId ?? null,
      dltMessageId: config.dltMessageId ?? null,
    },
    numbers: config.numbers ?? [],
    templates,
    authTemplates,
    metaTemplates: config.metaTemplates ?? [],
    health: config.health ?? null,
    wallet: config.wallet ?? null,
    profile: config.profile ?? null,
    phoneDetails: config.phoneDetails ?? null,
    readyForOtp,
    otpChannel,
  };
}

export async function saveApiKey(tenantId: string, apiKey: string) {
  const trimmed = apiKey.trim();
  if (!trimmed) throw new Error("API key is required");
  const enc = encryptSecret(trimmed);
  const lastFour = lastFourOfSecret(trimmed);

  await prisma.$transaction([
    prisma.tenantIntegrationSecret.upsert({
      where: {
        tenantId_provider_keyName: {
          tenantId,
          provider: FAST2SMS_PROVIDER,
          keyName: API_KEY_NAME,
        },
      },
      create: {
        tenantId,
        provider: FAST2SMS_PROVIDER,
        keyName: API_KEY_NAME,
        ciphertext: enc.ciphertext,
        iv: enc.iv,
        authTag: enc.authTag,
        lastFour,
      },
      update: {
        ciphertext: enc.ciphertext,
        iv: enc.iv,
        authTag: enc.authTag,
        lastFour,
      },
    }),
    prisma.tenantIntegration.upsert({
      where: { tenantId_provider: { tenantId, provider: FAST2SMS_PROVIDER } },
      create: {
        tenantId,
        provider: FAST2SMS_PROVIDER,
        status: "DISCONNECTED",
      },
      update: { lastError: null },
    }),
  ]);
}

export async function syncWhatsApp(tenantId: string): Promise<WhatsAppStatusDto> {
  const apiKey = await loadApiKey(tenantId);
  if (!apiKey) throw new WhatsAppNotConfiguredError("Save a Fast2SMS API key first");

  try {
    const [numbersRes, templatesRes] = await Promise.all([
      getWabaNumbers(apiKey),
      getWabaTemplates(apiKey),
    ]);
    const numbers = (numbersRes.data ?? []).map((row) => ({
      waba_id: row.waba_id,
      phone_number_id: row.phone_number_id,
      number: row.number,
      verified_name: row.verified_name,
      name_status: row.name_status,
      quality_rating: row.quality_rating,
      messaging_limit: row.messaging_limit,
      platform_type: row.platform_type,
      connection_status: row.connection_status,
    }));
    const templates = (templatesRes.data ?? []).flatMap((row) => row.templates ?? []);

    const existing = await getIntegrationRow(tenantId);
    const prev = asConfig(existing?.config);
    let phoneNumberId = prev.phoneNumberId;
    if (!phoneNumberId && numbers.length === 1) {
      phoneNumberId = str(numbers[0].phone_number_id);
    }
    const selectedNumber =
      numbers.find((n) => str(n.phone_number_id) === phoneNumberId) ?? numbers[0];
    const wabaId = selectedNumber ? str(selectedNumber.waba_id) : prev.wabaId;

    let health = prev.health ?? null;
    let wallet = prev.wallet ?? null;
    let metaTemplates = prev.metaTemplates ?? [];
    let profile: unknown = prev.profile ?? null;
    let phoneDetails: unknown = prev.phoneDetails ?? null;
    const graphVersion = prev.graphVersion || DEFAULT_GRAPH_VERSION;
    if (wabaId) {
      try {
        health = await getWabaHealth(apiKey, wabaId, graphVersion);
      } catch {
        health = prev.health ?? null;
      }
      try {
        const listed = await listMessageTemplates(apiKey, wabaId, { limit: 50, graphVersion });
        const data = listed && typeof listed === "object" ? (listed as { data?: Fast2SmsMetaTemplate[] }).data : null;
        if (Array.isArray(data)) metaTemplates = data;
      } catch {
        /* Meta Graph proxy may be unavailable for this WABA */
      }
    }
    if (phoneNumberId) {
      try {
        phoneDetails = await getPhoneNumberDetails(apiKey, phoneNumberId, graphVersion);
      } catch {
        phoneDetails = prev.phoneDetails ?? null;
      }
      try {
        profile = await getBusinessProfile(apiKey, phoneNumberId, graphVersion);
      } catch {
        profile = prev.profile ?? null;
      }
    }
    try {
      wallet = await getWallet(apiKey);
    } catch {
      wallet = prev.wallet ?? null;
    }

    const authTemplates = templates.filter(isApprovedAuthTemplate);
    let authTemplateName = prev.authTemplateName;
    let authTemplateLanguage = prev.authTemplateLanguage;
    let authMessageId = prev.authMessageId;
    let pendingAuthTemplateName = prev.pendingAuthTemplateName;
    let pendingAuthTemplateStatus = prev.pendingAuthTemplateStatus;
    if (pendingAuthTemplateName) {
      const approvedPending = authTemplates.find((t) => t.template_name === pendingAuthTemplateName);
      const anyPending = templates.find((t) => t.template_name === pendingAuthTemplateName);
      const metaPending = metaTemplates.find(
        (t) => (t.name ?? "").toLowerCase() === pendingAuthTemplateName.toLowerCase()
      );
      if (approvedPending) {
        authTemplateName = approvedPending.template_name;
        authTemplateLanguage = approvedPending.language || "en_US";
        authMessageId = str(approvedPending.message_id);
        pendingAuthTemplateStatus = "APPROVED";
      } else if (anyPending) {
        authMessageId = str(anyPending.message_id) || authMessageId;
        pendingAuthTemplateStatus = anyPending.status || pendingAuthTemplateStatus;
      } else if (metaPending?.status) {
        pendingAuthTemplateStatus = metaPending.status;
        if (String(metaPending.status).toUpperCase() === "APPROVED" && !authTemplateName) {
          authTemplateName = pendingAuthTemplateName;
          authTemplateLanguage = metaPending.language || "en_US";
        }
      }
    }
    if (authTemplateName) {
      const stillAuth = authTemplates.find((t) => t.template_name === authTemplateName);
      const stillAny = templates.find((t) => t.template_name === authTemplateName);
      if (stillAuth) {
        authMessageId = str(stillAuth.message_id);
        authTemplateLanguage = stillAuth.language || authTemplateLanguage || "en";
      } else if (stillAny && isUsableSimpleTemplate(stillAny)) {
        authMessageId = str(stillAny.message_id);
        authTemplateLanguage = stillAny.language || authTemplateLanguage || "en";
      } else if (
        templates.length > 0 &&
        pendingAuthTemplateName !== authTemplateName &&
        !metaTemplates.some((t) => (t.name ?? "") === authTemplateName)
      ) {
        authTemplateName = undefined;
        authTemplateLanguage = undefined;
        authMessageId = undefined;
      }
    } else if (authTemplates.length === 1) {
      authTemplateName = authTemplates[0].template_name;
      authTemplateLanguage = authTemplates[0].language || "en";
      authMessageId = str(authTemplates[0].message_id);
    }

    const config: WhatsAppIntegrationConfig = {
      ...prev,
      wabaId,
      phoneNumberId: phoneNumberId || undefined,
      displayPhone: selectedNumber?.number ? str(selectedNumber.number) : prev.displayPhone,
      verifiedName: selectedNumber?.verified_name ?? prev.verifiedName,
      qualityRating: selectedNumber?.quality_rating ?? prev.qualityRating,
      connectionStatus: selectedNumber?.connection_status ?? prev.connectionStatus,
      authTemplateName,
      authTemplateLanguage,
      authMessageId,
      pendingAuthTemplateName,
      pendingAuthTemplateStatus,
      graphVersion,
      numbers,
      templates,
      metaTemplates,
      health,
      wallet,
      profile,
      phoneDetails,
    };

    await prisma.tenantIntegration.upsert({
      where: { tenantId_provider: { tenantId, provider: FAST2SMS_PROVIDER } },
      create: {
        tenantId,
        provider: FAST2SMS_PROVIDER,
        status: "CONNECTED",
        config: config as Prisma.InputJsonValue,
        lastError: null,
        lastSyncedAt: new Date(),
      },
      update: {
        status: "CONNECTED",
        config: config as Prisma.InputJsonValue,
        lastError: null,
        lastSyncedAt: new Date(),
      },
    });

    return getWhatsAppStatus(tenantId);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Fast2SMS sync failed";
    await prisma.tenantIntegration.upsert({
      where: { tenantId_provider: { tenantId, provider: FAST2SMS_PROVIDER } },
      create: {
        tenantId,
        provider: FAST2SMS_PROVIDER,
        status: "ERROR",
        lastError: message,
      },
      update: { status: "ERROR", lastError: message },
    });
    throw err;
  }
}

export async function saveWhatsAppDefaults(
  tenantId: string,
  input: {
    phoneNumberId?: string;
    authTemplateName?: string;
    authTemplateLanguage?: string;
    smsOtpId?: string;
    smsSenderId?: string;
    dltMessageId?: string;
  }
): Promise<WhatsAppStatusDto> {
  const existing = await getIntegrationRow(tenantId);
  const prev = asConfig(existing?.config);
  const numbers = prev.numbers ?? [];
  const templates = prev.templates ?? [];
  const phoneNumberId = input.phoneNumberId || prev.phoneNumberId;
  const number = phoneNumberId
    ? numbers.find((n) => str(n.phone_number_id) === phoneNumberId)
    : numbers[0];
  if (input.phoneNumberId && !number) {
    throw new Error("Unknown phone number id — sync WABA details first");
  }

  let authTemplateName = prev.authTemplateName;
  let authTemplateLanguage = prev.authTemplateLanguage;
  let authMessageId = prev.authMessageId;
  if (input.authTemplateName) {
    const template = templates.find((t) => t.template_name === input.authTemplateName);
    if (template) {
      if (!isApprovedAuthTemplate(template) && !isUsableSimpleTemplate(template)) {
        throw new Error(
          "Select an approved template. AUTHENTICATION Copy Code is preferred for OTP."
        );
      }
      authTemplateName = template.template_name;
      authTemplateLanguage = input.authTemplateLanguage?.trim() || template.language || "en";
      authMessageId = str(template.message_id);
    } else {
      authTemplateName = input.authTemplateName;
      authTemplateLanguage = input.authTemplateLanguage?.trim() || prev.authTemplateLanguage || "en_US";
    }
  }

  const config: WhatsAppIntegrationConfig = {
    ...prev,
    wabaId: number ? str(number.waba_id) || prev.wabaId : prev.wabaId,
    phoneNumberId: phoneNumberId || prev.phoneNumberId,
    displayPhone: number?.number ? str(number.number) : prev.displayPhone,
    verifiedName: number?.verified_name ?? prev.verifiedName,
    qualityRating: number?.quality_rating ?? prev.qualityRating,
    connectionStatus: number?.connection_status ?? prev.connectionStatus,
    authTemplateName,
    authTemplateLanguage,
    authMessageId,
    smsOtpId: input.smsOtpId !== undefined ? input.smsOtpId.trim() || undefined : prev.smsOtpId,
    smsSenderId: input.smsSenderId !== undefined ? input.smsSenderId.trim() || undefined : prev.smsSenderId,
    dltMessageId: input.dltMessageId !== undefined ? input.dltMessageId.trim() || undefined : prev.dltMessageId,
    graphVersion: prev.graphVersion || DEFAULT_GRAPH_VERSION,
  };

  await prisma.tenantIntegration.upsert({
    where: { tenantId_provider: { tenantId, provider: FAST2SMS_PROVIDER } },
    create: {
      tenantId,
      provider: FAST2SMS_PROVIDER,
      status: prev.numbers?.length ? "CONNECTED" : "DISCONNECTED",
      config: config as Prisma.InputJsonValue,
      lastError: null,
    },
    update: {
      status: existing?.status === "ERROR" ? "CONNECTED" : existing?.status ?? "CONNECTED",
      config: config as Prisma.InputJsonValue,
      lastError: null,
    },
  });

  return getWhatsAppStatus(tenantId);
}

export type LoadedWhatsAppSendConfig = {
  apiKey: string;
  phoneNumberId: string;
  templateName: string;
  language: string;
  graphVersion: string;
  channel: OtpSendChannel;
  messageId?: string;
  smsOtpId?: string;
};

export async function loadSendConfig(tenantId: string): Promise<LoadedWhatsAppSendConfig> {
  const apiKey = await loadApiKey(tenantId);
  if (!apiKey) throw new WhatsAppNotConfiguredError();
  const integration = await getIntegrationRow(tenantId);
  const config = asConfig(integration?.config);
  if (integration?.status !== "CONNECTED") {
    throw new WhatsAppNotConfiguredError();
  }
  const graphVersion = config.graphVersion || DEFAULT_GRAPH_VERSION;
  const pendingUnapproved =
    Boolean(config.pendingAuthTemplateName) &&
    config.pendingAuthTemplateName === config.authTemplateName &&
    Boolean(config.pendingAuthTemplateStatus) &&
    !["APPROVED", "ACTIVE", ""].includes(String(config.pendingAuthTemplateStatus).toUpperCase());
  if (config.phoneNumberId && config.authTemplateName && !pendingUnapproved) {
    return {
      apiKey,
      phoneNumberId: config.phoneNumberId,
      templateName: config.authTemplateName,
      language: config.authTemplateLanguage || "en",
      graphVersion,
      channel: "whatsapp_auth",
      messageId: config.authMessageId,
      smsOtpId: config.smsOtpId,
    };
  }
  if (config.phoneNumberId && config.authMessageId) {
    return {
      apiKey,
      phoneNumberId: config.phoneNumberId,
      templateName: config.authTemplateName || "",
      language: config.authTemplateLanguage || "en",
      graphVersion,
      channel: "whatsapp_simple",
      messageId: config.authMessageId,
      smsOtpId: config.smsOtpId,
    };
  }
  if (config.smsOtpId) {
    return {
      apiKey,
      phoneNumberId: config.phoneNumberId || "",
      templateName: "",
      language: "en",
      graphVersion,
      channel: "sms_otp",
      smsOtpId: config.smsOtpId,
    };
  }
  throw new WhatsAppNotConfiguredError(
    "No OTP channel ready. Create/approve a WhatsApp AUTHENTICATION Copy Code template (or pick a simple message_id), or set a Fast2SMS SMS otp_id."
  );
}

function tenDigitMobile(e164: string): string {
  return e164.length > 10 ? e164.slice(-10) : e164;
}

export async function sendOtpMessage(tenantId: string, toE164: string, otp: string) {
  const cfg = await loadSendConfig(tenantId);
  const mobile = tenDigitMobile(toE164);
  let lastError: unknown;

  if (cfg.channel === "whatsapp_auth") {
    try {
      return await sendAuthenticationTemplate({
        apiKey: cfg.apiKey,
        phoneNumberId: cfg.phoneNumberId,
        to: toE164,
        templateName: cfg.templateName,
        language: cfg.language,
        otp,
        graphVersion: cfg.graphVersion,
      });
    } catch (err) {
      lastError = err;
    }
  }

  if (cfg.messageId && cfg.phoneNumberId) {
    try {
      return await sendTemplateSimple({
        apiKey: cfg.apiKey,
        messageId: cfg.messageId,
        phoneNumberId: cfg.phoneNumberId,
        numbers: mobile,
        variablesValues: otp,
        udf1: "erp-otp",
      });
    } catch (err) {
      lastError = err;
    }
  }

  if (cfg.smsOtpId) {
    return sendSmsOtp({
      apiKey: cfg.apiKey,
      mobile,
      otpId: cfg.smsOtpId,
      otp,
      otpExpiry: 5,
      udf1: "erp-otp",
    });
  }

  if (lastError instanceof Error) throw lastError;
  throw new WhatsAppNotConfiguredError(
    "WhatsApp AUTH send failed. Create an approved Copy Code template, pick a simple message_id, or set SMS otp_id."
  );
}

export async function createAuthCopyCodeTemplate(tenantId: string, name = "erp_auth_copycode") {
  const apiKey = await loadApiKey(tenantId);
  if (!apiKey) throw new WhatsAppNotConfiguredError("Save a Fast2SMS API key first");
  const existing = await getIntegrationRow(tenantId);
  const prev = asConfig(existing?.config);
  const wabaId = prev.wabaId;
  if (!wabaId) throw new Error("Sync WABA first so we have a WABA ID");
  const created = await createCopyCodeTemplate(apiKey, wabaId, {
    name,
    language: prev.authTemplateLanguage || "en_US",
    graphVersion: prev.graphVersion,
  });
  const rec = created && typeof created === "object" ? (created as Record<string, unknown>) : {};
  await prisma.tenantIntegration.update({
    where: { tenantId_provider: { tenantId, provider: FAST2SMS_PROVIDER } },
    data: {
      config: {
        ...prev,
        pendingAuthTemplateName: name,
        pendingAuthTemplateStatus: String(rec.status ?? "PENDING"),
        authTemplateName: prev.authTemplateName || name,
        authTemplateLanguage: prev.authTemplateLanguage || "en_US",
      } as Prisma.InputJsonValue,
    },
  });
  try {
    return await syncWhatsApp(tenantId);
  } catch {
    return getWhatsAppStatus(tenantId);
  }
}

export async function createUtilityHelloTemplate(tenantId: string, name = "erp_sample_hello") {
  const apiKey = await loadApiKey(tenantId);
  if (!apiKey) throw new WhatsAppNotConfiguredError("Save a Fast2SMS API key first");
  const existing = await getIntegrationRow(tenantId);
  const prev = asConfig(existing?.config);
  const wabaId = prev.wabaId;
  if (!wabaId) throw new Error("Sync WABA first so we have a WABA ID");
  await createTextTemplate(apiKey, wabaId, {
    name,
    language: "en",
    category: "UTILITY",
    body: "Hi {{1}}, this is a Sankalp ERP WhatsApp test message.",
    example: ["there"],
    graphVersion: prev.graphVersion,
  });
  try {
    return await syncWhatsApp(tenantId);
  } catch {
    return getWhatsAppStatus(tenantId);
  }
}

export async function sendSampleMessage(
  tenantId: string,
  input: { phone: string; mode: "session" | "simple" | "otp"; text?: string }
) {
  const apiKey = await loadApiKey(tenantId);
  if (!apiKey) throw new WhatsAppNotConfiguredError();
  const existing = await getIntegrationRow(tenantId);
  const prev = asConfig(existing?.config);
  if (!prev.phoneNumberId) throw new Error("Select a phone number ID first");
  const to = input.phone.replace(/\D/g, "");
  const e164 = to.length === 10 ? `91${to}` : to;

  if (input.mode === "session") {
    return sendSessionSimple({
      apiKey,
      phoneNumberId: prev.phoneNumberId,
      to: e164,
      payload: {
        type: "text",
        text: input.text || "Sankalp ERP test: WhatsApp is connected.",
        udf1: "erp-sample",
      },
    });
  }
  if (input.mode === "simple") {
    if (!prev.authMessageId) throw new Error("No Fast2SMS message_id selected. Sync and pick a template.");
    return sendTemplateSimple({
      apiKey,
      messageId: prev.authMessageId,
      phoneNumberId: prev.phoneNumberId,
      numbers: e164.slice(-10),
      variablesValues: input.text || "there",
      udf1: "erp-sample",
    });
  }
  const otp = String(Math.floor(100000 + Math.random() * 900000));
  const sent = await sendOtpMessage(tenantId, e164, otp);
  return { ...sent, otpHint: otp };
}

export async function lookupDeliveryReport(tenantId: string, requestId: string) {
  const apiKey = await loadApiKey(tenantId);
  if (!apiKey) throw new WhatsAppNotConfiguredError();
  return fetchDeliveryReport(apiKey, requestId);
}

export async function lookupWhatsAppLogs(tenantId: string, from: string, to: string) {
  const apiKey = await loadApiKey(tenantId);
  if (!apiKey) throw new WhatsAppNotConfiguredError();
  const [logs, summary, smsLogs, smsSummary] = await Promise.allSettled([
    getWhatsAppLogs(apiKey, from, to),
    getWhatsAppSummary(apiKey, from, to),
    getSmsLogs(apiKey, from, to),
    getSmsLogsSummary(apiKey, from, to),
  ]);
  return {
    logs: logs.status === "fulfilled" ? logs.value : { error: String(logs.reason) },
    summary: summary.status === "fulfilled" ? summary.value : { error: String(summary.reason) },
    smsLogs: smsLogs.status === "fulfilled" ? smsLogs.value : { error: String(smsLogs.reason) },
    smsSummary: smsSummary.status === "fulfilled" ? smsSummary.value : { error: String(smsSummary.reason) },
  };
}

export async function createCustomMetaTemplate(tenantId: string, payload: Record<string, unknown>) {
  const apiKey = await loadApiKey(tenantId);
  if (!apiKey) throw new WhatsAppNotConfiguredError("Save a Fast2SMS API key first");
  const existing = await getIntegrationRow(tenantId);
  const prev = asConfig(existing?.config);
  const wabaId = prev.wabaId;
  if (!wabaId) throw new Error("Sync WABA first so we have a WABA ID");
  const created = await createMessageTemplate(apiKey, wabaId, payload, prev.graphVersion);
  try {
    await syncWhatsApp(tenantId);
  } catch {
    /* keep create result even if sync fails */
  }
  return created;
}

export async function lookupSmsDeliveryReport(tenantId: string, requestId: string) {
  const apiKey = await loadApiKey(tenantId);
  if (!apiKey) throw new WhatsAppNotConfiguredError();
  return fetchSmsDeliveryReport(apiKey, requestId);
}

export async function lookupDltCatalog(tenantId: string, type: "sender" | "template" = "sender") {
  const apiKey = await loadApiKey(tenantId);
  if (!apiKey) throw new WhatsAppNotConfiguredError();
  return listDlt(apiKey, type);
}

export async function listTenantWebhooks(
  tenantId: string,
  channel: "whatsapp" | "sms" | "otp" | "rcs" = "whatsapp"
) {
  const apiKey = await loadApiKey(tenantId);
  if (!apiKey) throw new WhatsAppNotConfiguredError();
  return listWebhooks(apiKey, channel);
}

export async function saveTenantWebhook(
  tenantId: string,
  channel: "whatsapp" | "sms" | "otp" | "rcs",
  payload: Record<string, unknown>,
  id?: string
) {
  const apiKey = await loadApiKey(tenantId);
  if (!apiKey) throw new WhatsAppNotConfiguredError();
  return id
    ? updateWebhook(apiKey, channel, id, payload)
    : createWebhook(apiKey, channel, payload);
}

export async function removeTenantWebhook(
  tenantId: string,
  channel: "whatsapp" | "sms" | "otp" | "rcs",
  id: string
) {
  const apiKey = await loadApiKey(tenantId);
  if (!apiKey) throw new WhatsAppNotConfiguredError();
  return deleteWebhook(apiKey, channel, id);
}
