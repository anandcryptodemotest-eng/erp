export function buildWhatsAppMessage(
  items: { productName: string; quantity: number; unit?: string }[]
): string {
  const lines = items
    .map((i) => `Product: ${i.productName}\nQuantity: ${i.quantity}${i.unit ? ` ${i.unit}` : ""}`)
    .join("\n\n");
  return `Hello,\nWe require the following products.\n\n${lines}\n\nPlease confirm availability.`;
}
