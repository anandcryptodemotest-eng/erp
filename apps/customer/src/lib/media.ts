/** Local catalog images — under `/media/products` (not `/products`, which is an app route). */

export const LOCAL = {
  hero: "/media/products/hero-yard.jpg",
  plywood: "/media/products/plywood-marine.jpg",
  timber: "/media/products/timber.jpg",
  warehouse: "/media/products/warehouse.jpg",
  laminate: "/media/products/laminate.jpg",
} as const;

const NAME_MATCHES: { pattern: RegExp; src: string }[] = [
  { pattern: /ply|marine|bwr|bwp|sheet|blockboard|mdf|particle/i, src: LOCAL.plywood },
  { pattern: /timber|wood|lumber|teak/i, src: LOCAL.timber },
  { pattern: /laminate|veneer|mica/i, src: LOCAL.laminate },
  { pattern: /hardwar|screw|fitting/i, src: LOCAL.warehouse },
];

/** Uploaded admin UI screenshots / known non-product assets — never show in shop. */
const BAD_UPLOAD_MARKERS = [
  "1785648829163-899970c1",
];

export function heroImageUrl(): string {
  return LOCAL.hero;
}

function isUsableProductImage(url: string): boolean {
  const u = url.trim();
  if (!u) return false;
  if (BAD_UPLOAD_MARKERS.some((m) => u.includes(m))) return false;
  // Prefer real catalog paths and http(s) CDNs; skip empty placeholders
  if (u.startsWith("data:image/svg")) return false;
  return true;
}

function normalizeImageUrl(url: string): string {
  // Prefer same-origin paths when seed stored absolute localhost URLs
  if (url.includes("/media/products/")) {
    return url.slice(url.indexOf("/media/products/"));
  }
  // Legacy public path — remap to /media to avoid clash with /products app routes
  if (url.includes("/products/") && !url.includes("/uploads/products/")) {
    const file = url.slice(url.lastIndexOf("/") + 1);
    if (/\.(jpe?g|png|webp|gif)$/i.test(file)) {
      return `/media/products/${file}`;
    }
  }
  if (url.includes("/uploads/")) {
    return url.slice(url.indexOf("/uploads/"));
  }
  return url;
}

function fallbackForName(name?: string, sku?: string, id?: string, index = 0): string {
  const hay = `${name ?? ""} ${sku ?? ""}`;
  for (const rule of NAME_MATCHES) {
    if (rule.pattern.test(hay)) return rule.src;
  }
  const pool = [LOCAL.plywood, LOCAL.timber, LOCAL.warehouse, LOCAL.laminate];
  const seed = (id ?? name ?? String(index))
    .split("")
    .reduce((a, c) => a + c.charCodeAt(0), 0);
  return pool[seed % pool.length];
}

/** Primary tile/thumb image for listings. */
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
  const fromList = Array.isArray(product.imageUrls)
    ? product.imageUrls.find((u) => typeof u === "string" && isUsableProductImage(u))
    : null;
  if (typeof fromList === "string") {
    return normalizeImageUrl(fromList);
  }
  if (product.imageUrl && isUsableProductImage(product.imageUrl)) {
    return normalizeImageUrl(product.imageUrl);
  }
  return fallbackForName(product.name, product.sku, product.id, index);
}

/** Gallery list — precedence: SKU imageUrls → single imageUrl → name/category fallback. */
export function productGalleryUrls(
  product: {
    id?: string;
    sku?: string;
    imageUrl?: string | null;
    imageUrls?: string[] | null;
    name?: string;
  }
): string[] {
  const raw = [
    ...(Array.isArray(product.imageUrls) ? product.imageUrls : []),
    product.imageUrl,
  ].filter((u): u is string => typeof u === "string" && isUsableProductImage(u));

  const normalized = [...new Set(raw.map(normalizeImageUrl))];
  if (normalized.length) return normalized;
  return [fallbackForName(product.name, product.sku, product.id)];
}

export function categoryImageUrl(name: string, imageUrl?: string | null): string {
  if (imageUrl && isUsableProductImage(imageUrl)) return normalizeImageUrl(imageUrl);
  const key = name.toLowerCase();
  if (key.includes("ply") || key.includes("block")) return LOCAL.plywood;
  if (key.includes("timber") || key.includes("wood")) return LOCAL.timber;
  if (key.includes("laminate")) return LOCAL.laminate;
  return LOCAL.warehouse;
}
