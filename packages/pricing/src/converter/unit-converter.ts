/**
 * Central UOM conversion — strategies must not convert ad hoc.
 * Factors are relative to SI/canonical bases per dimension family.
 */

const LENGTH_TO_M: Record<string, number> = {
  m: 1,
  meter: 1,
  metre: 1,
  mm: 0.001,
  cm: 0.01,
  in: 0.0254,
  inch: 0.0254,
  ft: 0.3048,
  foot: 0.3048,
  feet: 0.3048,
};

const AREA_TO_M2: Record<string, number> = {
  m2: 1,
  sq_m: 1,
  "m²": 1,
  sqm: 1,
  sq_ft: 0.09290304,
  sqft: 0.09290304,
  ft2: 0.09290304,
  sq_in: 0.00064516,
};

const VOLUME_TO_M3: Record<string, number> = {
  m3: 1,
  "m³": 1,
  cu_m: 1,
  liter: 0.001,
  litre: 0.001,
  l: 0.001,
  ml: 0.000001,
  cu_ft: 0.0283168466,
};

const MASS_TO_KG: Record<string, number> = {
  kg: 1,
  g: 0.001,
  lb: 0.45359237,
  ton: 1000,
  tonne: 1000,
};

function norm(uom: string): string {
  return uom.trim().toLowerCase().replace(/\s+/g, "_");
}

function tableFor(uom: string): Record<string, number> | null {
  const u = norm(uom);
  if (u in LENGTH_TO_M) return LENGTH_TO_M;
  if (u in AREA_TO_M2) return AREA_TO_M2;
  if (u in VOLUME_TO_M3) return VOLUME_TO_M3;
  if (u in MASS_TO_KG) return MASS_TO_KG;
  return null;
}

export function convert(value: number, fromUom: string, toUom: string): number {
  const from = norm(fromUom);
  const to = norm(toUom);
  if (from === to) return value;
  if (from === "each" || to === "each") {
    throw new Error(`Cannot convert between '${fromUom}' and '${toUom}'`);
  }
  const table = tableFor(from);
  const tableTo = tableFor(to);
  if (!table || !tableTo || table !== tableTo) {
    throw new Error(`Incompatible UOMs: ${fromUom} → ${toUom}`);
  }
  const fromF = table[from];
  const toF = table[to];
  if (fromF == null || toF == null) {
    throw new Error(`Unknown UOM conversion: ${fromUom} → ${toUom}`);
  }
  return (value * fromF) / toF;
}

export function sameFamily(a: string, b: string): boolean {
  try {
    convert(1, a, b);
    return true;
  } catch {
    return false;
  }
}
