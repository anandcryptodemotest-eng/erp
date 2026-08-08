export function normalizeCustomerPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;

  const normalized = phone.replace(/\D/g, "");
  return normalized.length >= 7 ? normalized : null;
}