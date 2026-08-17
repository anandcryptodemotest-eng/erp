/** NPCI UPI collect URI — payload producer only; Document Studio QR has no UPI knowledge. */

const VPA_RE = /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z][a-zA-Z0-9.-]{1,63}$/;

export function isValidVpa(vpa: string): boolean {
  return VPA_RE.test(vpa.trim());
}

export function buildUpiPayUri(opts: {
  vpa: string;
  payeeName: string;
  amount: number;
  tn: string;
}): string {
  const q = new URLSearchParams();
  q.set("pa", opts.vpa.trim());
  q.set("pn", (opts.payeeName.trim() || "Payee").slice(0, 99));
  q.set("am", opts.amount.toFixed(2));
  q.set("cu", "INR");
  q.set("tn", opts.tn);
  return `upi://pay?${q.toString()}`;
}

export function invoicePaymentPayload(input: {
  vpa?: string;
  payeeName: string;
  invoiceNumber: string;
  total: number;
  paidAmount?: number;
}): { vpa: string; amountDue: number; upiUri?: string } | undefined {
  const vpa = (input.vpa ?? "").trim();
  if (!vpa || !isValidVpa(vpa)) return undefined;
  const paid = Math.max(0, input.paidAmount ?? 0);
  const amountDue = Math.max(0, Math.round((input.total - paid) * 100) / 100);
  const payment: { vpa: string; amountDue: number; upiUri?: string } = { vpa, amountDue };
  if (amountDue > 0) {
    payment.upiUri = buildUpiPayUri({
      vpa,
      payeeName: input.payeeName,
      amount: amountDue,
      tn: input.invoiceNumber,
    });
  }
  return payment;
}
