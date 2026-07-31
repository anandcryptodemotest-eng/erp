import { prisma } from "@/lib/prisma";
import { buildProductConfigKey } from "@/lib/config-key";

/**
 * Reject create/update when another active product shares brand + identity attribute fingerprint.
 * No persisted configKey — computed at validation time.
 */
export async function findIdentityDuplicate(opts: {
  tenantId: string;
  brandId: string | null | undefined;
  brandName: string;
  identityKeys: string[];
  attrs: Record<string, unknown>;
  excludeProductId?: string;
}): Promise<{ sku: string } | null> {
  const { tenantId, brandId, brandName, identityKeys, attrs, excludeProductId } = opts;
  if (!identityKeys.length) return null;

  const fingerprint = buildProductConfigKey(["brand", ...identityKeys], {
    brand: brandName || brandId || "",
    ...attrs,
  });
  if (!fingerprint) return null;

  const candidates = await prisma.product.findMany({
    where: {
      tenantId,
      isActive: true,
      ...(brandId ? { brandId } : { brandId: null }),
      ...(excludeProductId ? { NOT: { id: excludeProductId } } : {}),
    },
    select: { sku: true, customAttributes: true },
    take: 5000,
  });

  for (const p of candidates) {
    const otherAttrs =
      p.customAttributes && typeof p.customAttributes === "object" && !Array.isArray(p.customAttributes)
        ? (p.customAttributes as Record<string, unknown>)
        : {};
    const otherFp = buildProductConfigKey(["brand", ...identityKeys], {
      brand: brandName || brandId || "",
      ...otherAttrs,
    });
    if (otherFp && otherFp === fingerprint) return { sku: p.sku };
  }
  return null;
}
