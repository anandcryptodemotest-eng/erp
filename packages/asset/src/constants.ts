import type { AssetType } from "./types";

/** MIME type → AssetType mapping for uploads */
export const MIME_TO_ASSET_TYPE: Record<string, AssetType> = {
  "image/jpeg": "IMAGE",
  "image/png": "IMAGE",
  "image/webp": "IMAGE",
  "image/gif": "IMAGE",
  "video/mp4": "VIDEO",
  "video/webm": "VIDEO",
  "audio/mpeg": "VOICE",
  "audio/webm": "VOICE",
  "audio/ogg": "VOICE",
  "audio/wav": "VOICE",
  "application/pdf": "DOCUMENT",
  "application/msword": "DOCUMENT",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCUMENT",
  "application/vnd.ms-excel": "DOCUMENT",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "DOCUMENT",
  "application/vnd.ms-powerpoint": "DOCUMENT",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "DOCUMENT",
  "text/plain": "FILE",
  "text/csv": "FILE",
};

/** Default max upload size: 25 MB */
export const MAX_ASSET_SIZE = 25 * 1024 * 1024;

/** Allowed MIME types for chat attachments */
export const ALLOWED_CHAT_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/webm",
  "audio/mpeg",
  "audio/webm",
  "audio/ogg",
  "audio/wav",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
]);

/** Resolve AssetType from MIME type, defaulting to FILE */
export function resolveAssetType(mimeType: string): AssetType {
  return MIME_TO_ASSET_TYPE[mimeType] ?? "FILE";
}