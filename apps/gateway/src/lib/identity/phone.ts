/** Digits-only E.164-ish phone. 10-digit local numbers assume India (+91). */
export function normalizeWhatsAppPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.length === 10) digits = `91${digits}`;
  if (digits.length < 11 || digits.length > 15) return null;
  return digits;
}

export function syntheticOtpEmail(e164: string): string {
  return `otp+${e164}@users.invalid`;
}

export function maskPhone(e164: string): string {
  if (e164.length <= 4) return e164;
  return `${"*".repeat(Math.max(0, e164.length - 4))}${e164.slice(-4)}`;
}
