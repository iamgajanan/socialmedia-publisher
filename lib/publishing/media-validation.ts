import "server-only";

import sharp from "sharp";
import type { MediaAsset } from "./providers/types";

export const MAX_MEDIA_BYTES = 100 * 1024 * 1024;
export const MAX_IMAGE_PIXELS = 100_000_000;
export const INSTAGRAM_IMAGE_MAX_BYTES = 8 * 1024 * 1024;
export const INSTAGRAM_MIN_WIDTH = 320;
export const INSTAGRAM_MAX_WIDTH = 1440;
export const INSTAGRAM_MIN_RATIO = 4 / 5;
export const INSTAGRAM_MAX_RATIO = 1.91;

const SUPPORTED_MEDIA_TYPES = new Set([
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
]);

const VIDEO_SIGNATURES: Record<string, (bytes: Uint8Array) => boolean> = {
  "video/mp4": (bytes) =>
    bytes.length >= 12 &&
    new TextDecoder().decode(bytes.slice(4, 8)) === "ftyp",
  "video/quicktime": (bytes) =>
    bytes.length >= 12 &&
    new TextDecoder().decode(bytes.slice(4, 8)) === "ftyp",
  "video/webm": (bytes) =>
    bytes.length >= 4 &&
    bytes[0] === 0x1a &&
    bytes[1] === 0x45 &&
    bytes[2] === 0xdf &&
    bytes[3] === 0xa3,
  "video/x-matroska": (bytes) =>
    bytes.length >= 4 &&
    bytes[0] === 0x1a &&
    bytes[1] === 0x45 &&
    bytes[2] === 0xdf &&
    bytes[3] === 0xa3,
};

export type MediaValidationMetadata = {
  width?: number;
  height?: number;
  size: number;
  mimeType: string;
};

export function validateMediaMetadata(
  media: MediaAsset,
  metadata: MediaValidationMetadata,
): string | null {
  if (!SUPPORTED_MEDIA_TYPES.has(metadata.mimeType)) {
    return `Unsupported media MIME type: ${metadata.mimeType}.`;
  }

  if (metadata.size <= 0) {
    return "Media file is empty.";
  }

  if (metadata.size > MAX_MEDIA_BYTES) {
    return "Media file exceeds the 100 MB application limit.";
  }

  if (metadata.mimeType.startsWith("image/")) {
    if (!metadata.width || !metadata.height) {
      return "Image dimensions could not be determined.";
    }

    if (metadata.width * metadata.height > MAX_IMAGE_PIXELS) {
      return "Image exceeds the maximum supported pixel count.";
    }
  }

  if (media.mimeType !== metadata.mimeType) {
    return `Stored media type ${metadata.mimeType} does not match the expected type ${media.mimeType}.`;
  }

  return null;
}

export function validateInstagramPreparedImage(
  metadata: MediaValidationMetadata,
): string | null {
  if (metadata.mimeType !== "image/jpeg") {
    return "Instagram images must be JPEG after media preparation.";
  }

  if (metadata.size > INSTAGRAM_IMAGE_MAX_BYTES) {
    return "Instagram image exceeds the 8 MB publishing limit.";
  }

  if (!metadata.width || !metadata.height) {
    return "Instagram image dimensions could not be determined.";
  }

  const ratio = metadata.width / metadata.height;
  if (metadata.width < INSTAGRAM_MIN_WIDTH) {
    return "Instagram image width must be at least 320 pixels.";
  }

  if (metadata.width > INSTAGRAM_MAX_WIDTH) {
    return "Instagram image width exceeds 1,440 pixels.";
  }

  if (ratio < INSTAGRAM_MIN_RATIO || ratio > INSTAGRAM_MAX_RATIO) {
    return "Instagram image aspect ratio must be between 4:5 and 1.91:1.";
  }

  return null;
}

export async function inspectImageBuffer(
  media: MediaAsset,
  bytes: Buffer,
): Promise<MediaValidationMetadata> {
  const metadata = await sharp(bytes).metadata();
  return {
    width: metadata.width,
    height: metadata.height,
    size: bytes.byteLength,
    mimeType: media.mimeType,
  };
}

export function hasVideoContainerSignature(
  mimeType: string,
  bytes: Uint8Array,
): boolean {
  const checker = VIDEO_SIGNATURES[mimeType];
  return checker ? checker(bytes) : false;
}
