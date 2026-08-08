/**
 * DocumentPayloadProvider — domain owns PDF payload construction.
 * Widgets only select payloadBuilder id; they never know binding paths.
 */

export type PayloadBuildContext = {
  tenantId: string;
  userId?: string;
  salesOrderId?: string;
  entityId?: string;
  documentType?: string;
  formValues?: Record<string, string>;
  extra?: Record<string, unknown>;
};

export interface DocumentPayloadProvider {
  /** e.g. "accounting.invoice" | "sales.quote" */
  type: string;
  build(context: PayloadBuildContext): Promise<Record<string, unknown>>;
}

const registry = new Map<string, DocumentPayloadProvider>();

export function registerDocumentPayloadProvider(provider: DocumentPayloadProvider): void {
  registry.set(provider.type, provider);
}

export function getDocumentPayloadProvider(type: string): DocumentPayloadProvider | undefined {
  return registry.get(type);
}

export function listDocumentPayloadProviders(): DocumentPayloadProvider[] {
  return Array.from(registry.values());
}
