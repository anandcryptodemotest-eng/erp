import { convert } from "../converter/unit-converter";
import {
  emptyMeasure,
  type AttributeDef,
  type Measure,
} from "../context/types";

/**
 * Parse size strings with a pattern like "{L}x{W}" against values like "8x4".
 */
export function parseSizePattern(
  value: string,
  pattern: string
): { length: number; width: number } | null {
  const parts = pattern.split(/(\{L\}|\{W\}|\{H\})/);
  let re = "^";
  for (const p of parts) {
    if (p === "{L}") re += "(?<L>[\\d.]+)";
    else if (p === "{W}") re += "(?<W>[\\d.]+)";
    else if (p === "{H}") re += "(?<H>[\\d.]+)";
    else re += p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  re += "$";
  const m = new RegExp(re, "i").exec(String(value).trim());
  if (!m?.groups) return null;
  const length = Number(m.groups.L);
  const width = Number(m.groups.W);
  if (!Number.isFinite(length) || !Number.isFinite(width)) return null;
  return { length, width };
}

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) {
    return Number(v);
  }
  return null;
}

/**
 * Resolve measures from product attributes + definitions into a rich Measure.
 * Linear dims converted into `targetLinearUom` (default ft for area pricing).
 */
export function resolveMeasure(
  attributes: Record<string, unknown>,
  attributeDefs: AttributeDef[],
  opts: { targetLinearUom?: string; targetAreaUom?: string; productWeight?: number | null; productWeightUnit?: string | null } = {}
): Measure {
  const linearUom = opts.targetLinearUom ?? "ft";
  const areaUom = opts.targetAreaUom ?? "sq_ft";
  const measure = emptyMeasure(areaUom);
  const byKey = Object.fromEntries(attributeDefs.map((d) => [d.key, d]));

  for (const [key, raw] of Object.entries(attributes)) {
    const def = byKey[key];
    if (!def?.measureRole || def.measureRole === "NONE") continue;

    if (def.sizePattern && typeof raw === "string") {
      const parsed = parseSizePattern(raw, def.sizePattern);
      if (parsed) {
        const from = def.measureUnit || linearUom;
        measure.length = convert(parsed.length, from, linearUom);
        measure.width = convert(parsed.width, from, linearUom);
        measure.area = measure.length * measure.width;
        measure.uom = areaUom;
        // If area UOM differs from linear², convert
        if (areaUom === "sq_m" && linearUom === "ft") {
          measure.area = convert(measure.area, "sq_ft", "sq_m");
        } else if (areaUom === "sq_ft" && linearUom === "m") {
          measure.area = convert(measure.area, "sq_m", "sq_ft");
        }
      }
      continue;
    }

    const n = num(raw);
    if (n == null) continue;
    const from = def.measureUnit || linearUom;

    switch (def.measureRole) {
      case "LENGTH":
        measure.length = convert(n, from, linearUom);
        break;
      case "WIDTH":
        measure.width = convert(n, from, linearUom);
        break;
      case "HEIGHT":
        measure.height = convert(n, from, linearUom);
        break;
      case "THICKNESS":
        measure.thickness = convert(n, from, from.includes("mm") ? "mm" : linearUom);
        break;
      case "AREA":
        measure.area = convert(n, from, areaUom);
        measure.uom = areaUom;
        break;
      case "VOLUME":
        measure.volume = convert(n, from, "m3");
        measure.uom = "m3";
        break;
      case "WEIGHT":
        measure.weight = convert(n, from, "kg");
        measure.uom = "kg";
        break;
      default:
        break;
    }
  }

  if (measure.area == null && measure.length != null && measure.width != null) {
    measure.area = measure.length * measure.width;
    measure.uom = areaUom;
  }
  if (
    measure.volume == null &&
    measure.length != null &&
    measure.width != null &&
    measure.height != null
  ) {
    measure.volume = measure.length * measure.width * measure.height;
  }

  if (measure.weight == null && opts.productWeight != null) {
    const wu = opts.productWeightUnit || "kg";
    measure.weight = convert(opts.productWeight, wu, "kg");
    if (!measure.uom || measure.uom === areaUom) measure.uom = "kg";
  }

  return measure;
}
