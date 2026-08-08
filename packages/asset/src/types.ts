/**
 * Platform Asset types.
 *
 * Asset is a first-class platform capability — not owned by Communication,
 * Documents, or any single module. All capabilities reference assets via AssetRef.
 */

/** Extensible asset kinds. Extends workflow AssetType with MEDIA. */
export type AssetType =
  | "DOCUMENT"
  | "MEDIA"
  | "IMAGE"
  | "VIDEO"
  | "VOICE"
  | "FILE"
  | "REPORT";

/**
 * Immutable reference to a platform asset.
 * Stored as JSON in Prisma; strongly typed at the application layer.
 * Consistent with the workflow package's AssetRef pattern.
 */
export interface AssetRef {
  type: AssetType;
  id: string;
  version: number;
}

/** Asset metadata returned to clients (never exposes storagePath). */
export interface AssetMetadata {
  id: string;
  tenantId: string;
  type: AssetType;
  fileName: string;
  mimeType: string;
  fileSize: number;
  url: string;
  thumbnailUrl: string | null;
  duration: number | null;
  width: number | null;
  height: number | null;
  uploadedBy: string;
  createdAt: string;
}

/** Input for creating an asset (internal — includes storage details). */
export interface CreateAssetInput {
  tenantId: string;
  type: AssetType;
  fileName: string;
  mimeType: string;
  fileSize: number;
  checksum?: string;
  storageType?: string;
  storagePath: string;
  url: string;
  thumbnailUrl?: string;
  duration?: number;
  width?: number;
  height?: number;
  uploadedBy: string;
}