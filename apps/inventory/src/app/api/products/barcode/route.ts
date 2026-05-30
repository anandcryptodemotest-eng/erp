import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// ─── GS1 Variable-Weight Barcode (scale-printed labels) ────────────────────
// EAN-13 barcodes starting with 20-29 encode weight in the barcode itself.
// Format: 2X PPPPP WWWWW C  (prefix 2 digits, PLU 5 digits, weight-grams 5 digits, check 1)
// Example: 2100045003456 → PLU=00045, weight=345g=0.345kg
function parseVariableWeight(code: string): { pluCode: string; weightKg: number } | null {
  if (code.length !== 13) return null;
  const prefix = parseInt(code.substring(0, 2), 10);
  if (prefix < 20 || prefix > 29) return null;
  const pluCode = code.substring(2, 7);          // digits 3–7 (zero-padded PLU)
  const weightGrams = parseInt(code.substring(7, 12), 10); // digits 8–12
  return { pluCode: String(parseInt(pluCode, 10)), weightKg: weightGrams / 1000 };
}

// GET /api/products/barcode?code=8901030929024
// Handles: (1) variable-weight scale barcodes, (2) catalog lookup, (3) Open Food Facts fallback
export async function GET(request: Request) {
  const tenantId = request.headers.get("x-tenant-id");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });

  const url = new URL(request.url);
  const code = url.searchParams.get("code")?.trim();
  if (!code) return NextResponse.json({ error: "code is required" }, { status: 400 });

  // 1. Detect scale-printed variable-weight barcode (20–29 prefix)
  const vw = parseVariableWeight(code);
  if (vw) {
    const product = await prisma.product.findFirst({
      where: { tenantId, pluCode: vw.pluCode, isActive: true },
      include: { stocks: true },
    });
    if (product) {
      return NextResponse.json({
        data: {
          ...product,
          source: "local",
          exists: true,
          variableWeight: true,
          weightKg: vw.weightKg,
          lineTotal: Math.round(product.sellPrice * vw.weightKg * 100) / 100,
        },
      });
    }
    // PLU not set up yet — return partial so UI can prompt to create product
    return NextResponse.json({
      data: {
        barcode: null,
        pluCode: vw.pluCode,
        name: "",
        unit: "kg",
        sellByWeight: true,
        source: "scale",
        exists: false,
        variableWeight: true,
        weightKg: vw.weightKg,
      },
    });
  }

  // 2. Check own catalog by fixed barcode
  const existing = await prisma.product.findFirst({
    where: { tenantId, barcode: code, isActive: true },
    include: { stocks: true },
  });
  if (existing) {
    return NextResponse.json({ data: { ...existing, source: "local", exists: true } });
  }

  // 2. Fall back to Open Food Facts (free, no API key required)
  try {
    const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json`, {
      headers: { "User-Agent": "SimhapuriFreshERP/1.0" },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return NextResponse.json({ data: null, exists: false });

    const off = await res.json() as {
      status: number;
      product?: {
        product_name?: string;
        product_name_en?: string;
        brands?: string;
        quantity?: string;
        serving_size?: string;
        categories_tags?: string[];
        image_front_url?: string;
      };
    };

    if (off.status !== 1 || !off.product) {
      return NextResponse.json({ data: null, exists: false });
    }

    const p = off.product;
    const name = p.product_name_en ?? p.product_name ?? "";
    const unit = deriveUnit(p.quantity ?? p.serving_size ?? "");
    const brand = p.brands ?? "";

    return NextResponse.json({
      data: {
        barcode: code,
        name: brand ? `${name} (${brand})` : name,
        unit,
        source: "openfoodfacts",
        exists: false,
      },
    });
  } catch {
    return NextResponse.json({ data: null, exists: false });
  }
}

function deriveUnit(quantity: string): string {
  const q = quantity.toLowerCase();
  if (q.includes("kg") || q.includes("g")) return "kg";
  if (q.includes("l") || q.includes("ml")) return "L";
  if (q.includes("dozen")) return "dozen";
  return "pcs";
}
