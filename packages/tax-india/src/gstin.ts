const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

const CHECKSUM_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function gstinChecksumChar(gstin14: string): string {
  let sum = 0;
  let factor = 1;
  for (let i = 0; i < 14; i++) {
    const codePoint = CHECKSUM_CHARS.indexOf(gstin14[i]!);
    if (codePoint < 0) return "";
    const addend = factor * codePoint;
    factor = factor === 1 ? 2 : 1;
    sum += Math.floor(addend / 36) + (addend % 36);
  }
  const remainder = sum % 36;
  const checkCodePoint = (36 - remainder) % 36;
  return CHECKSUM_CHARS[checkCodePoint] ?? "";
}

export function parseGstinStateCode(gstin: string): string | null {
  const normalized = gstin.trim().toUpperCase();
  if (normalized.length < 2 || !/^\d{2}/.test(normalized)) return null;
  const code = normalized.slice(0, 2);
  const n = parseInt(code, 10);
  if (n < 1 || n > 37) return null;
  return code;
}

export function validateGstinChecksum(gstin: string): boolean {
  const normalized = gstin.trim().toUpperCase();
  if (!GSTIN_REGEX.test(normalized)) return false;
  const expected = gstinChecksumChar(normalized.slice(0, 14));
  return expected === normalized[14];
}

export function validateGstin(gstin: string): { valid: boolean; stateCode?: string; error?: string } {
  const normalized = gstin.trim().toUpperCase();
  if (!normalized) return { valid: false, error: "GSTIN is empty" };
  if (!GSTIN_REGEX.test(normalized)) {
    return { valid: false, error: "Invalid GSTIN format" };
  }
  if (!validateGstinChecksum(normalized)) {
    return { valid: false, error: "Invalid GSTIN checksum" };
  }
  const stateCode = parseGstinStateCode(normalized);
  if (!stateCode) return { valid: false, error: "Invalid state code in GSTIN" };
  return { valid: true, stateCode };
}
