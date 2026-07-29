import {
  getTheme,
  listThemes,
  registerTheme,
  type ThemeTokens,
} from "@erp/extensions";

const DEFAULTS: ThemeTokens[] = [
  {
    id: "oms-default",
    displayName: "OMS Default",
    panelBorder: "border-emerald-600",
    panelBg: "bg-white",
    accentText: "text-emerald-700",
    buttonBg: "bg-emerald-700",
    buttonText: "text-white",
    legacy: "emerald",
  },
  {
    id: "oms-attention",
    displayName: "OMS Attention",
    panelBorder: "border-amber-500",
    panelBg: "bg-amber-50",
    accentText: "text-amber-800",
    buttonBg: "bg-amber-600",
    buttonText: "text-white",
    legacy: "amber",
  },
];

let bootstrapped = false;

export function ensureDefaultThemes(): void {
  if (bootstrapped) return;
  bootstrapped = true;
  for (const t of DEFAULTS) {
    if (!getTheme(t.id)) registerTheme(t);
  }
}

/** Resolve theme id or legacy emerald/amber */
export function resolveTheme(themeIdOrLegacy?: string | null): ThemeTokens {
  ensureDefaultThemes();
  if (!themeIdOrLegacy) return getTheme("oms-default")!;
  const direct = getTheme(themeIdOrLegacy);
  if (direct) return direct;
  if (themeIdOrLegacy === "emerald") return getTheme("oms-default")!;
  if (themeIdOrLegacy === "amber") return getTheme("oms-attention")!;
  const byLegacy = listThemes().find((t) => t.legacy === themeIdOrLegacy);
  return byLegacy ?? getTheme("oms-default")!;
}
