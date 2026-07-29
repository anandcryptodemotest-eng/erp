import type { FormDefinition, FormFieldDefinition } from "@erp/workflow";
import type { ThemeTokens } from "@erp/extensions";
import type { ReactNode } from "react";

export type WidgetCategory = "Business" | "Workflow" | "Input" | "System" | "Visualization";

export interface FormWidgetRef {
  widget: string;
  props?: Record<string, unknown>;
}

export interface ScreenSection {
  widgets: FormWidgetRef[];
}

/** Screen Definition — FORM catalog body (layout-driven). */
export type ScreenDefinition = FormDefinition & {
  layout?: FormWidgetRef[];
  sections?: ScreenSection[];
  /** Theme id e.g. oms-default; legacy emerald/amber still accepted on FormDefinition.theme */
  themeId?: string;
};

export interface WidgetManifest {
  id: string;
  category: WidgetCategory;
  displayName: string;
  icon: string;
  supportsValidation: boolean;
  supportsPayload: boolean;
  defaultProps?: Record<string, unknown>;
  version?: string;
}

export interface ValidationResult {
  ok: boolean;
  errors?: string[];
}

export interface LineItemLike {
  id: string;
  productId?: string;
  productName: string;
  quantity: number;
  unitPrice?: number;
  purchasePrice?: number | null;
  availableQty?: number | null;
  [key: string]: unknown;
}

export interface CatalogProductHit {
  id: string;
  name: string;
  sku?: string | null;
  sellPrice?: number | null;
}

/** Host-provided line editing (Screen Controller). Widgets never call REST. */
export interface LineEditorApi {
  canAdd: boolean;
  canRemove: boolean;
  canEditPrice: boolean;
  searchProducts: (q: string) => Promise<CatalogProductHit[]>;
  addProduct: (p: CatalogProductHit) => void;
  removeLine: (lineId: string) => void;
  cancelOrder?: () => void;
}

export interface UIContext {
  entity: { type: string; id: string; data: Record<string, unknown> };
  order?: Record<string, unknown> | null;
  customer?: { id?: string; name?: string | null } | null;
  items?: LineItemLike[];
  workflow?: { template?: string; version?: number; variables?: Record<string, unknown> };
  task?: { id?: string; stepKey?: string; action?: string; status?: string };
  permissions: { canEdit: boolean; canComplete: boolean; roles: string[] };
  variables: Record<string, unknown>;
  /** Mutable field bag for FormFields / collector */
  fieldValues: Record<string, string>;
  setFieldValue: (key: string, value: string, itemId?: string) => void;
  screen: ScreenDefinition;
  theme: ThemeTokens;
  lineEditor?: LineEditorApi;
}

export type UIEventType =
  | "ItemAdded"
  | "ItemRemoved"
  | "QuantityChanged"
  | "FieldChanged"
  | "AttachmentUploaded"
  | string;

export interface UIEvent {
  type: UIEventType;
  payload?: unknown;
}

export interface UIEventBus {
  publish(event: UIEvent): void;
  subscribe(type: UIEventType | "*", handler: (event: UIEvent) => void): () => void;
}

export interface DialogApi {
  confirm(message: string, title?: string): Promise<boolean>;
  open?(opts: { title: string; body: ReactNode }): void;
}

export interface ToastApi {
  success(message: string): void;
  error(message: string): void;
  info?(message: string): void;
}

export interface NavigationApi {
  push?(path: string): void;
  back?(): void;
}

export interface ClipboardApi {
  writeText(text: string): Promise<void>;
}

export interface LocalizationApi {
  t(key: string, fallback?: string): string;
}

export interface UIRuntime {
  context: UIContext;
  dialog: DialogApi;
  toast: ToastApi;
  navigation: NavigationApi;
  clipboard: ClipboardApi;
  localization: LocalizationApi;
  theme: ThemeTokens;
  events: UIEventBus;
}

export interface Widget {
  render(runtime: UIRuntime, props: Record<string, unknown>): ReactNode;
  validate(runtime: UIRuntime, props: Record<string, unknown>): ValidationResult;
  collectPayload(runtime: UIRuntime, props: Record<string, unknown>): Record<string, unknown>;
}

export type WidgetFactory = () => Widget;

export interface RegisteredWidget {
  manifest: WidgetManifest;
  factory: WidgetFactory;
}

export type { FormFieldDefinition, FormDefinition, ThemeTokens };
