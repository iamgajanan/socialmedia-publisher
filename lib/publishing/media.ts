import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  MAX_MEDIA_BYTES,
  hasVideoContainerSignature,
  inspectImageBuffer,
  validateMediaMetadata,
} from "./media-validation";
import type { MediaAsset } from "./providers/types";

const BUCKET = "social-media-assets";
const SIGNED_URL_TTL = 60 * 30;

function mimeFromPath(path: string) {
  const lower = path.toLowerCase();
  if (lower.endsWith(".mp4")) return "video/mp4";
  if (lower.endsWith(".mov")) return "video/quicktime";
  if (lower.endsWith(".webm")) return "video/webm";
  if (lower.endsWith(".mkv")) return "video/x-matroska";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".avif")) return "image/avif";
  if (lower.endsWith(".tif") || lower.endsWith(".tiff")) return "image/tiff";
  if (lower.endsWith(".bmp")) return "image/bmp";
  return "application/octet-stream";
}

async function readRemoteMetadata(media: MediaAsset): Promise<MediaAsset> {
  const headResponse = await fetch(media.url, {
    method: "HEAD",
    cache: "no-store",
  });

  if (!headResponse.ok) {
    throw new Error(`Unable to inspect media (${headResponse.status}).`);
  }

  const remoteMimeType = headResponse.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase();
  if (!remoteMimeType) {
    throw new Error("Stored media is missing a MIME type.");
  }

  const sizeHeader = headResponse.headers.get("content-length");
  const parsedSize = sizeHeader ? Number(sizeHeader) : 0;
  if (!Number.isFinite(parsedSize) || parsedSize < 0 || parsedSize > MAX_MEDIA_BYTES) {
    throw new Error("Stored media size could not be validated or exceeds the 100 MB application limit.");
  }

  const resolved = { ...media, mimeType: remoteMimeType, size: parsedSize };

  if (remoteMimeType.startsWith("image/")) {
    const imageResponse = await fetch(media.url, { cache: "no-store" });
    if (!imageResponse.ok) {
      throw new Error(`Unable to read image media (${imageResponse.status}).`);
    }
    const bytes = Buffer.from(await imageResponse.arrayBuffer());
    if (bytes.byteLength !== parsedSize && parsedSize > 0) {
      throw new Error("Stored media size changed while it was being read.");
    }

    if (bytes.byteLength > MAX_MEDIA_BYTES) {
      throw new Error("Media file exceeds the 100 MB application limit.");
    }
    const metadata = await inspectImageBuffer(resolved, bytes);
    const validationError = validateMediaMetadata(media, metadata);
    if (validationError) throw new Error(validationError);
    return { ...resolved, size: bytes.byteLength };
  }

  if (remoteMimeType.startsWith("video/")) {
    const rangeResponse = await fetch(media.url, {
      headers: { Range: "bytes=0-31" },
      cache: "no-store",
    });
    if (!rangeResponse.ok && rangeResponse.status !== 206) {
      throw new Error(`Unable to inspect video media (${rangeResponse.status}).`);
    }
    const signature = new Uint8Array(await rangeResponse.arrayBuffer());
    const contentRange = rangeResponse.headers.get("content-range");
    const totalFromRange = contentRange?.match(/\/(\d+)$/)?.[1];
    const size = parsedSize || Number(totalFromRange ?? 0);
    if (!size || !Number.isFinite(size) || size > MAX_MEDIA_BYTES) {
      throw new Error("Stored video size could not be validated or exceeds the 100 MB application limit.");
    }
    if (!hasVideoContainerSignature(remoteMimeType, signature)) {
      throw new Error("Video container does not match its declared MIME type.");
    }

    const validationError = validateMediaMetadata(media, {
      size,
      mimeType: remoteMimeType,
    });
    if (validationError) throw new Error(validationError);
    return { ...resolved, size };
  }

  throw new Error(`Unsupported stored media MIME type: ${remoteMimeType}.`);
}

export async function resolveMedia(paths: string[]): Promise<MediaAsset[]> {
  if (!paths.length) return [];
  const admin = createAdminClient();
  const assets: MediaAsset[] = [];

  for (const path of paths) {
    const expectedMimeType = mimeFromPath(path);
    const { data, error } = await admin.storage
      .from(BUCKET)
      .createSignedUrl(path, SIGNED_URL_TTL);

    if (error || !data?.signedUrl) {
      throw new Error(`Unable to create a media URL for ${path}.`);
    }

    const asset = await readRemoteMetadata({
      path,
      url: data.signedUrl,
      mimeType: expectedMimeType,
      size: 0,
    });

    assets.push(asset);
  }

  return assets;
}
