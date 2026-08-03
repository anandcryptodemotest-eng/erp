import { ensureDefaultThemes, registerActivity } from "@erp/ui-runtime";
import { SO_TASK_TYPES } from "@erp/workflow";
import { ensureOmsWidgetsRegistered } from "./widgets/oms-widgets";
import { adminWidgetCatalog, type WidgetCatalogEntry } from "./widgetCatalog";

export type BootstrapAdminRuntimeOptions = {
  /** Filtered catalog (tenant/feature flags). Defaults to full admin catalog. */
  catalog?: Record<string, WidgetCatalogEntry>;
  theme?: { themeId?: string };
  options?: {
    registerActivities?: boolean;
  };
};

let bootstrapped = false;
let lastCatalogKey = "";

/**
 * Single public setup API for Admin Host consumers (Gateway, Platform).
 * Idempotent — apps configure; they do not own raw widget registration.
 */
export function bootstrapAdminRuntime(opts: BootstrapAdminRuntimeOptions = {}): void {
  const catalog = opts.catalog ?? adminWidgetCatalog;
  const catalogKey = Object.keys(catalog).sort().join(",");
  const registerActivities = opts.options?.registerActivities !== false;

  ensureDefaultThemes();
  // Widget factories register the full OMS set today; catalog filters designer visibility.
  // Future: register only entries present in `catalog`.
  ensureOmsWidgetsRegistered();

  if (!bootstrapped || (registerActivities && catalogKey !== lastCatalogKey)) {
    if (registerActivities) {
      for (const t of SO_TASK_TYPES) {
        registerActivity({
          type: t.type,
          label: t.label,
          kind: t.kind,
        });
      }
    }
    bootstrapped = true;
    lastCatalogKey = catalogKey;
  }

  void opts.theme;
}

/** @deprecated Prefer bootstrapAdminRuntime — kept for thin gateway re-exports during migration. */
export function ensurePlatformExtensionsBootstrapped(): void {
  bootstrapAdminRuntime();
}
