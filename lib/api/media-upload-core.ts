import { z } from "zod";

export const API_MEDIA_MAX_BYTES = 100 * 1024 * 1024;

export const API_MEDIA_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-matroska",
] as const;

const MAX_FILENAME_LENGTH = 120;

export type ApiMediaMimeType = (typeof API_MEDIA_MIME_TYPES)[number];

export function isSupportedApiMediaType(value: string): value is ApiMediaMimeType {
  return (API_MEDIA_MIME_TYPES as readonly string[]).includes(value);
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
