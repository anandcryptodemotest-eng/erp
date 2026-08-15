/** Deterministic catalog images — under `/media/products` (not `/products` app route).
 * Wrong image is worse than none: never assign a random product photo.
 */

export const LOCAL = {
  hero: "/media/products/hero-yard.jpg",
  plywood: "/media/products/plywood-marine.jpg",
  blockboard: "/media/products/blockboard.jpg",
  timber: "/media/products/timber.jpg",
  laminate: "/media/products/laminate.jpg",
  adhesive: "/media/products/adhesive.jpg",
  phone: "/media/products/phone.jpg",
  hardware: "/media/products/hardware.jpg",
  unavailable: "/media/products/unavailable.svg",
} as const;

/** SKU-family / name → known material still (deterministic). */
const FAMILY_MATCHES: { pattern: RegExp; src: string }[] = [
  { pattern: /\b(bwp|bwr|marine|plywood|ply)\b/i, src: LOCAL.plywood },
  { pattern: /blockboard|block.?board/i, src: LOCAL.blockboard },
  { pattern: /laminate|veneer|mica/i, src: LOCAL.laminate },
  { pattern: /adhesive|glue|fevicol/i, src: LOCAL.adhesive },
  { pattern: /\bphone\b|smartphone|mobile/i, src: LOCAL.phone },
  { pattern: /timber|lumber|teak|hardwood/i, src: LOCAL.timber },
  { pattern: /hardwar|screw|fitting|hinge|handle/i, src: LOCAL.hardware },
];

const CATEGORY_MATCHES: { pattern: RegExp; src: string }[] = [
  { pattern: /ply|block/i, src: LOCAL.plywood },
  { pattern: /laminate/i, src: LOCAL.laminate },
  { pattern: /adhesive|glue/i, src: LOCAL.adhesive },
  { pattern: /timber|wood/i, src: LOCAL.timber },
  { pattern: /phone|electr/i, src: LOCAL.phone },
  { pattern: /hardwar/i, src: LOCAL.hardware },
];

/** Uploaded admin UI screenshots / known non-product assets — never show in shop. */
const BAD_UPLOAD_MARKERS = ["1785648829163-899970c1"];

export function heroImageUrl(): string {
  return LOCAL.hero;
}

export function unavailableImageUrl(): string {
  return LOCAL.unavailable;
}

function isUsableProductImage(url: string): boolean {
  const u = url.trim();
  if (!u) return false;
  if (BAD_UPLOAD_MARKERS.some((m) => u.includes(m))) return false;
  if (u.startsWith("data:image/svg")) return false;
  return true;
}

function normalizeImageUrl(url: string): string {
  if (url.includes("/media/products/")) {
    return url.slice(url.indexOf("/media/products/"));
  }
  if (url.includes("/products/") && !url.includes("/uploads/products/")) {
    const file = url.slice(url.lastIndexOf("/") + 1);
    if (/\.(jpe?g|png|webp|gif|svg)$/i.test(file)) {
      return `/media/products/${file}`;
    }
  }
  if (url.includes("/uploads/")) {
    return url.slice(url.indexOf("/uploads/"));
  }
  return url;
}

function familyImage(name?: string | null, sku?: string | null): string | null {
  const hay = `${name ?? ""} ${sku ?? ""}`;
  for (const rule of FAMILY_MATCHES) {
    if (rule.pattern.test(hay)) return rule.src;
  }
  return null;
}

function categoryPlaceholder(categoryName?: string | null): string | null {
  if (!categoryName) return null;
  for (const rule of CATEGORY_MATCHES) {
    if (rule.pattern.test(categoryName)) return rule.src;
  }
  return null;
}

/**
 * Resolution: explicit product → explicit group/category image → SKU-family →
 * category placeholder → neutral Image unavailable. Never random.
 */
export function productImageUrl(
  product: {
    id?: string;
    sku?: string;
    imageUrl?: string | null;
    imageUrls?: string[] | null;
    name?: string;
    categoryName?: string | null;
    groupImageUrl?: string | null;
  }
): string {
  const fromList = Array.isArray(product.imageUrls)
    ? product.imageUrls.find((u) => typeof u === "string" && isUsableProductImage(u))
    : null;
  if (typeof fromList === "string") return normalizeImageUrl(fromList);

  if (product.imageUrl && isUsableProductImage(product.imageUrl)) {
    return normalizeImageUrl(product.imageUrl);
  }

  if (product.groupImageUrl && isUsableProductImage(product.groupImageUrl)) {
    return normalizeImageUrl(product.groupImageUrl);
  }

  return (
    familyImage(product.name, product.sku) ??
    categoryPlaceholder(product.categoryName) ??
    LOCAL.unavailable
  );
}

/** Gallery list — explicit URLs only, else single deterministic fallback. */
export function productGalleryUrls(product: {
  id?: string;
  sku?: string;
  imageUrl?: string | null;
  imageUrls?: string[] | null;
  name?: string;
  categoryName?: string | null;
}): string[] {
  const raw = [
    ...(Array.isArray(product.imageUrls) ? product.imageUrls : []),
    product.imageUrl,
  ].filter((u): u is string => typeof u === "string" && isUsableProductImage(u));

  const normalized = [...new Set(raw.map(normalizeImageUrl))];
  if (normalized.length) return normalized;
  return [productImageUrl(product)];
}

export function categoryImageUrl(name: string, imageUrl?: string | null): string {
  if (imageUrl && isUsableProductImage(imageUrl)) return normalizeImageUrl(imageUrl);
  return categoryPlaceholder(name) ?? familyImage(name) ?? LOCAL.unavailable;
}
