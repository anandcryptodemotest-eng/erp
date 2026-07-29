/**
 * Extension Registry — thin in-process plugin surface (Platform Architecture v1.0).
 * Dynamic marketplace loading is deferred.
 */

export type ExtensionType =
  | "widget"
  | "activity"
  | "metadata"
  | "theme"
  | "integration"
  | "validator"
  | "condition"
  | "ai";

export interface ExtensionManifest {
  id: string;
  name: string;
  version: string;
  type: ExtensionType;
}

export interface ExtensionRecord<T = unknown> {
  manifest: ExtensionManifest;
  implementation: T;
}

type Store = Map<string, ExtensionRecord>;

function key(type: ExtensionType, id: string) {
  return `${type}:${id}`;
}

const stores = new Map<ExtensionType, Store>();

function storeFor(type: ExtensionType): Store {
  let s = stores.get(type);
  if (!s) {
    s = new Map();
    stores.set(type, s);
  }
  return s;
}

export function registerExtension<T>(manifest: ExtensionManifest, implementation: T): void {
  if (!manifest.id?.trim()) throw new Error("ExtensionManifest.id is required");
  storeFor(manifest.type).set(key(manifest.type, manifest.id), { manifest, implementation });
}

export function getExtension<T>(type: ExtensionType, id: string): ExtensionRecord<T> | undefined {
  return storeFor(type).get(key(type, id)) as ExtensionRecord<T> | undefined;
}

export function listExtensions<T>(type: ExtensionType): ExtensionRecord<T>[] {
  return [...storeFor(type).values()] as ExtensionRecord<T>[];
}

export function clearExtensions(type?: ExtensionType): void {
  if (type) stores.delete(type);
  else stores.clear();
}

/** Activity registration helper */
export interface ActivityExtension {
  type: string;
  label: string;
  kind: "HUMAN" | "SYSTEM";
  description?: string;
  defaultScreenId?: string;
}

export function registerActivity(ext: ActivityExtension & { version?: string }): void {
  registerExtension(
    {
      id: ext.type,
      name: ext.label,
      version: ext.version ?? "1.0.0",
      type: "activity",
    },
    ext
  );
}

export function getActivity(type: string): ActivityExtension | undefined {
  return getExtension<ActivityExtension>("activity", type)?.implementation;
}

export function listActivities(): ActivityExtension[] {
  return listExtensions<ActivityExtension>("activity").map((r) => r.implementation);
}

/** Theme registration helper */
export interface ThemeTokens {
  id: string;
  displayName: string;
  panelBorder: string;
  panelBg: string;
  accentText: string;
  buttonBg: string;
  buttonText: string;
  /** Legacy alias for OMS panels */
  legacy?: "emerald" | "amber";
}

export function registerTheme(theme: ThemeTokens & { version?: string }): void {
  registerExtension(
    {
      id: theme.id,
      name: theme.displayName,
      version: theme.version ?? "1.0.0",
      type: "theme",
    },
    theme
  );
}

export function getTheme(id: string): ThemeTokens | undefined {
  return getExtension<ThemeTokens>("theme", id)?.implementation;
}

export function listThemes(): ThemeTokens[] {
  return listExtensions<ThemeTokens>("theme").map((r) => r.implementation);
}
