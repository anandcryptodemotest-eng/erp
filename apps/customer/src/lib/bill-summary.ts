/** Standard customer-facing bill rows for cart / checkout / order detail. */

export type MoneyBill = {
  subtotal: number;
  discount?: number;
  tax?: number;
  delivery?: number;
  roundOff?: number;
  total: number;
};

export type BillRow = {
  label: string;
  value: string;
  muted?: boolean;
  emphasize?: boolean;
};

function inr(n: number): string {
  return `₹${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

/** Build BillSummary rows. Zero discount/delivery/round-off rows are omitted. Tax always shown. */
export function billSummaryRows(bill: MoneyBill): BillRow[] {
  const rows: BillRow[] = [
    { label: "Subtotal", value: inr(bill.subtotal) },
  ];
  if (bill.discount && bill.discount > 0) {
    rows.push({ label: "Discount", value: `−${inr(bill.discount)}`, muted: true });
  }
  rows.push({
    label: "Tax / GST",
    value: inr(bill.tax ?? 0),
    muted: !(bill.tax && bill.tax > 0),
  });
  if (bill.delivery && bill.delivery > 0) {
    rows.push({ label: "Delivery", value: inr(bill.delivery) });
  }
  if (bill.roundOff && Math.abs(bill.roundOff) > 0.001) {
    rows.push({ label: "Round-off", value: inr(bill.roundOff), muted: true });
  }
  return rows;
}

export function estimateBillFromLines(
  lines: { price: number; qty: number; taxRate?: number }[],
  opts?: { discount?: number; delivery?: number }
): MoneyBill {
  const subtotal = lines.reduce((s, l) => s + l.price * l.qty, 0);
  const discount = opts?.discount ?? 0;
  const delivery = opts?.delivery ?? 0;
  const discounted = Math.max(0, subtotal - discount);
  const tax = lines.reduce((s, l) => {
    const line = l.price * l.qty;
    const share = subtotal > 0 ? (line / subtotal) * discounted : line;
    const rate = typeof l.taxRate === "number" && l.taxRate > 0 ? l.taxRate : 0;
    return s + share * rate;
  }, 0);
  const total = discounted + tax + delivery;
  return { subtotal, discount, tax, delivery, total };
}
