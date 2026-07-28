/** Local catalog images served from the customer app `/public/products`. */

export const LOCAL = {
  hero: "/products/hero-yard.jpg",
  plywood: "/products/plywood-marine.jpg",
  timber: "/products/timber.jpg",
  warehouse: "/products/warehouse.jpg",
  laminate: "/products/laminate.jpg",
} as const;

const NAME_MATCHES: { pattern: RegExp; src: string }[] = [
  { pattern: /ply|marine|bwr|bwp|sheet/i, src: LOCAL.plywood },
  { pattern: /timber|wood|lumber|teak/i, src: LOCAL.timber },
  { pattern: /laminate|veneer|mica/i, src: LOCAL.laminate },
  { pattern: /hardwar|screw|fitting/i, src: LOCAL.warehouse },
];

export function heroImageUrl(): string {
  return LOCAL.hero;
}

export function productImageUrl(
  product: {
    id?: string;
    sku?: string;
    imageUrl?: string | null;
    imageUrls?: string[] | null;
    name?: string;
  },
  index = 0
): string {
  const fromList = Array.isArray(product.imageUrls) ? product.imageUrls[0] : null;
  if (typeof fromList === "string" && fromList.trim()) {
    // Prefer same-origin paths when seed stored absolute localhost URLs
    if (fromList.includes("/products/")) {
      const path = fromList.slice(fromList.indexOf("/products/"));
      return path;
    }
    return fromList;
  }
  if (product.imageUrl) return product.imageUrl;

  const hay = `${product.name ?? ""} ${product.sku ?? ""}`;
  for (const rule of NAME_MATCHES) {
    if (rule.pattern.test(hay)) return rule.src;
  }

  const pool = [LOCAL.plywood, LOCAL.timber, LOCAL.warehouse, LOCAL.laminate];
  const seed = (product.id ?? product.name ?? String(index))
    .split("")
    .reduce((a, c) => a + c.charCodeAt(0), 0);
  return pool[seed % pool.length];
}

export function categoryImageUrl(name: string, imageUrl?: string | null): string {
  if (imageUrl) return imageUrl;
  const key = name.toLowerCase();
  if (key.includes("ply")) return LOCAL.plywood;
  if (key.includes("timber") || key.includes("wood")) return LOCAL.timber;
  if (key.includes("laminate")) return LOCAL.laminate;
  return LOCAL.warehouse;
}
