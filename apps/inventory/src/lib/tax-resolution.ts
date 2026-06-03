import { serviceClient } from "@erp/config";

export type HsnConfidence = "EXACT" | "PARTIAL" | "MISSING" | "MANUAL";

export type TaxSuggestion = {
  taxCode?: string;
  taxRate?: number;
  confidence: HsnConfidence;
  source: "CLEAR" | "INTERNAL_MAP" | "NONE";
  reason: string;
};

const INTERNAL_HSN_GST_MAP: Array<{ prefix: string; taxCode: string; taxRate: number }> = [
  { prefix: "040120", taxCode: "GST_12", taxRate: 0.12 }, // Full cream milk
  { prefix: "070200", taxCode: "GST_5", taxRate: 0.05 },  // Tomato
  { prefix: "080390", taxCode: "GST_0", taxRate: 0.0 },   // Banana
  { prefix: "100630", taxCode: "GST_5", taxRate: 0.05 },  // Basmati rice
  { prefix: "0401", taxCode: "GST_12", taxRate: 0.12 }, // Milk and cream
  { prefix: "0702", taxCode: "GST_5", taxRate: 0.05 },  // Tomatoes
  { prefix: "0803", taxCode: "GST_0", taxRate: 0.0 },   // Bananas
  { prefix: "1006", taxCode: "GST_5", taxRate: 0.05 },  // Rice
];

function normalizeRate(rate: number): number {
  if (Number.isNaN(rate) || rate < 0) return 0;
  return rate > 1 ? rate / 100 : rate;
}

function sanitizeHsn(hsnCode?: string | null): string | undefined {
  if (!hsnCode) return undefined;
  const digits = hsnCode.replace(/\D/g, "");
  return digits.length > 0 ? digits : undefined;
}

function mapByInternalHsn(hsnCode: string): TaxSuggestion | null {
  const sorted = [...INTERNAL_HSN_GST_MAP].sort((a, b) => b.prefix.length - a.prefix.length);
  const match = sorted.find((entry) => hsnCode.startsWith(entry.prefix));
  if (!match) return null;

  const confidence: HsnConfidence = match.prefix.length >= 6 ? "EXACT" : "PARTIAL";
  return {
    taxCode: match.taxCode,
    taxRate: match.taxRate,
    confidence,
    source: "INTERNAL_MAP",
    reason: `Matched HSN prefix ${match.prefix}`,
  };
}

async function fetchClearSuggestion(hsnCode: string): Promise<TaxSuggestion | null> {
  const apiUrl = process.env.CLEAR_HSN_API_URL ?? "https://api.clear.in/api/ingestion/config/hsn/v2/search";
  const apiToken = process.env.CLEAR_HSN_API_TOKEN;
  const timeoutMs = Math.max(500, parseInt(process.env.CLEAR_HSN_TIMEOUT_MS ?? "2500"));

  if (!apiToken) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const url = `${apiUrl}?hsnSearchKey=${encodeURIComponent(hsnCode)}&page=0&size=20`;
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Accept": "application/json",
        "x-cleartax-auth-token": apiToken,
      },
      signal: controller.signal,
    });

    if (!response.ok) return null;
    const payload = (await response.json()) as Record<string, unknown>;

    const dataArray = Array.isArray(payload.data)
      ? payload.data
      : Array.isArray(payload.results)
      ? payload.results
      : [];

    const first = (dataArray[0] ?? null) as Record<string, unknown> | null;
    if (!first) return null;

    const fetchedCode = typeof first.hsnCode === "string" ? first.hsnCode.replace(/\D/g, "") : hsnCode;
    const gstRateRaw = typeof first.gstRate === "number"
      ? first.gstRate
      : typeof first.taxRate === "number"
      ? first.taxRate
      : undefined;

    if (gstRateRaw === undefined) return null;

    const normalized = normalizeRate(gstRateRaw);
    let taxCode = "GST_18";
    if (Math.abs(normalized - 0) < 0.000001) taxCode = "GST_0";
    else if (Math.abs(normalized - 0.05) < 0.000001) taxCode = "GST_5";
    else if (Math.abs(normalized - 0.12) < 0.000001) taxCode = "GST_12";
    else if (Math.abs(normalized - 0.18) < 0.000001) taxCode = "GST_18";
    else if (Math.abs(normalized - 0.28) < 0.000001) taxCode = "GST_28";

    return {
      taxCode,
      taxRate: normalized,
      confidence: fetchedCode === hsnCode && hsnCode.length >= 6 ? "EXACT" : "PARTIAL",
      source: "CLEAR",
      reason: "Suggested by Clear HSN lookup",
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function resolveTaxRate(
  tenantId: string,
  userId: string | undefined,
  countryCode: string,
  code?: string
): Promise<{ code: string; rate: number } | null> {
  const query = code
    ? `/api/tax-rates/resolve?countryCode=${encodeURIComponent(countryCode)}&code=${encodeURIComponent(code)}`
    : `/api/tax-rates/resolve?countryCode=${encodeURIComponent(countryCode)}`;

  const response = await serviceClient.call<{
    data?: { code?: string; rate?: number };
    error?: string;
  }>("accounting", query, {
    method: "GET",
    tenantId,
    userId,
  });

  if (response.status < 200 || response.status >= 300) return null;

  const payload = response.data?.data;
  if (!payload?.code || typeof payload.rate !== "number") return null;
  return { code: payload.code, rate: payload.rate };
}

export async function suggestTaxFromHsn(hsnCode?: string | null): Promise<TaxSuggestion> {
  const normalizedHsn = sanitizeHsn(hsnCode);
  if (!normalizedHsn) {
    return {
      confidence: "MISSING",
      source: "NONE",
      reason: "HSN missing",
    };
  }

  const clear = await fetchClearSuggestion(normalizedHsn);
  if (clear) return clear;

  const internal = mapByInternalHsn(normalizedHsn);
  if (internal) return internal;

  return {
    confidence: normalizedHsn.length >= 6 ? "PARTIAL" : "MISSING",
    source: "NONE",
    reason: "No HSN tax mapping found",
  };
}
