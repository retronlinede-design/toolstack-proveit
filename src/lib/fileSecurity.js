export const FILE_SIZE_WARNING_BYTES = 10 * 1024 * 1024;
export const FILE_SIZE_STRONG_WARNING_BYTES = 25 * 1024 * 1024;

export const ALLOWED_PREVIEW_IMAGE_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
];

export const ALLOWED_PREVIEW_MIME_TYPES = [
  ...ALLOWED_PREVIEW_IMAGE_MIME_TYPES,
  "application/pdf",
];

export function getDataUrlMimeType(dataUrl = "") {
  const match = String(dataUrl).match(/^data:([^;,]+)[;,]/i);
  return match?.[1]?.toLowerCase() || "";
}

export function getPreviewMimeType(dataUrl, fallbackType = "") {
  return getDataUrlMimeType(dataUrl) || String(fallbackType || "").toLowerCase();
}

export function isAllowedPreviewImageMimeType(mimeType = "") {
  return ALLOWED_PREVIEW_IMAGE_MIME_TYPES.includes(String(mimeType).toLowerCase());
}

export function isAllowedPreviewMimeType(mimeType = "") {
  return ALLOWED_PREVIEW_MIME_TYPES.includes(String(mimeType).toLowerCase());
}

export function getFileSizeWarning(file) {
  const size = Number(file?.size || 0);
  const name = file?.name || file?.fileName || "Selected file";

  if (size > FILE_SIZE_STRONG_WARNING_BYTES) {
    return `${name} is larger than 25MB. ProveIt will keep it, but large attachments can make backups and imports slower.`;
  }

  if (size > FILE_SIZE_WARNING_BYTES) {
    return `${name} is larger than 10MB. ProveIt will keep it, but large attachments can make backups and imports slower.`;
  }

  return "";
}
