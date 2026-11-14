import { z } from "zod";

export const API_MEDIA_MAX_BYTES = 100 * 1024 * 1024;

export const API_MEDIA_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
  "image/tiff",
  "image/bmp",
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-matroska",
  "application/pdf",
] as const;

const MAX_FILENAME_LENGTH = 120;

export type ApiMediaMimeType = (typeof API_MEDIA_MIME_TYPES)[number];

export function isSupportedApiMediaType(value: string): value is ApiMediaMimeType {
  return (API_MEDIA_MIME_TYPES as readonly string[]).includes(value);
}

/**
 * Determine the actual MIME type from the uploaded bytes instead of trusting
 * the multipart Content-Type header. Some URL downloaders attach image/jpeg
 * to PNG bytes, which then breaks provider uploads.
 *
 * WebM and Matroska share an EBML signature, so their extension or declared
 * multipart MIME type is used only to distinguish those two containers.
 */
export function detectApiMediaType(
  bytes: Uint8Array,
  filename: string,
  declaredType = "",
): ApiMediaMimeType | null {
  const startsWith = (...signature: number[]) =>
    signature.every((value, index) => bytes[index] === value);
  const ascii = (start: number, length: number) =>
    String.fromCharCode(...bytes.subarray(start, Math.min(start + length, bytes.length)));
  const lowerName = filename.toLowerCase();
  const declared = declaredType.trim().toLowerCase().split(";")[0] ?? "";

  if (startsWith(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "image/png";
  if (startsWith(0xff, 0xd8, 0xff)) return "image/jpeg";
  if (ascii(0, 6) === "GIF87a" || ascii(0, 6) === "GIF89a") return "image/gif";
  if (ascii(0, 4) === "RIFF" && ascii(8, 4) === "WEBP") return "image/webp";
  if (ascii(0, 2) === "BM") return "image/bmp";
  if (startsWith(0x49, 0x49, 0x2a, 0x00) || startsWith(0x4d, 0x4d, 0x00, 0x2a)) return "image/tiff";
  if (ascii(0, 5) === "%PDF-") return "application/pdf";

  // ISO-BMFF: AVIF and MP4/MOV both use an ftyp box.
  if (ascii(4, 4) === "ftyp" && bytes.length >= 12) {
    const brands = ascii(8, Math.min(24, bytes.length - 8));
    if (brands.includes("avif") || brands.includes("avis")) return "image/avif";
    if (brands.includes("qt  ")) return "video/quicktime";
    return "video/mp4";
  }

  // WebM and Matroska share the EBML magic bytes.
  if (startsWith(0x1a, 0x45, 0xdf, 0xa3)) {
    if (lowerName.endsWith(".mkv") || declared === "video/x-matroska") return "video/x-matroska";
    if (lowerName.endsWith(".webm") || declared === "video/webm") return "video/webm";
  }

  return null;
}

const EXTENSION_BY_MEDIA_TYPE: Record<ApiMediaMimeType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
  "image/tiff": "tiff",
  "image/bmp": "bmp",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
  "video/x-matroska": "mkv",
  "application/pdf": "pdf",
};

/**
 * Keep the stored object extension consistent with the MIME type detected
 * from its bytes. Publishing resolves media by its storage path, so a JPEG
 * saved as "slide.png" would otherwise be treated as PNG by downstream code.
 */
export function alignMediaFilenameWithType(
  filename: string,
  contentType: ApiMediaMimeType,
): string {
  const safeFilename = sanitizeMediaFilename(filename);
  const extension = EXTENSION_BY_MEDIA_TYPE[contentType];
  const lastDot = safeFilename.lastIndexOf(".");
  const basename = lastDot > 0 ? safeFilename.slice(0, lastDot) : safeFilename;
  return `${basename}.${extension}`.slice(0, MAX_FILENAME_LENGTH);
}

export function sanitizeMediaFilename(filename: string): string {
  const normalized = filename.trim().normalize("NFKC").replace(/[^A-Za-z0-9._(),+;@=&!$' -]/g, "_");
  const collapsed = normalized.replace(/\s+/g, " ").replace(/\.\.+/g, ".");
  return (collapsed || "upload").slice(0, MAX_FILENAME_LENGTH);
}

export const mediaUploadMetadataSchema = z.object({
  contentType: z.string().trim().min(1),
  size: z.number().int().nonnegative().max(API_MEDIA_MAX_BYTES),
  filename: z.string().trim().min(1).max(500),
}).superRefine((value, ctx) => {
  if (!isSupportedApiMediaType(value.contentType)) {
    ctx.addIssue({
      code: "custom",
      path: ["contentType"],
      message: "Unsupported media type.",
    });
  }
  if (!sanitizeMediaFilename(value.filename)) {
    ctx.addIssue({
      code: "custom",
      path: ["filename"],
      message: "Invalid filename.",
    });
  }
});

export function parseMediaUploadMetadata(input: unknown) {
  return mediaUploadMetadataSchema.safeParse(input);
}
