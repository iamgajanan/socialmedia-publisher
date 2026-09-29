import "server-only";

import { createHash } from "node:crypto";
import sharp from "sharp";
import { createAdminClient } from "@/lib/supabase/admin";
import type { MediaAsset } from "./providers/types";

const BUCKET = "social-media-assets";
const SIGNED_URL_TTL = 60 * 30;

export async function normalizeInstagramImage(media: MediaAsset): Promise<MediaAsset> {
  if (media.mimeType === "image/jpeg") return media;

  const admin = createAdminClient();
  const { data: source, error: downloadError } = await admin.storage.from(BUCKET).download(media.path);
  if (downloadError || !source) {
    throw new Error(`Unable to read Instagram image ${media.path} for normalization.`);
  }

  const sourceBuffer = Buffer.from(await source.arrayBuffer());
  let jpeg: Buffer;
  try {
    jpeg = await sharp(sourceBuffer)
      .rotate()
      .jpeg({ quality: 90, mozjpeg: true })
      .toBuffer();
  } catch {
    throw new Error(`Instagram could not decode image ${media.path}. Please upload a valid image file.`);
  }

  const key = createHash("sha256").update(media.path).digest("hex").slice(0, 32);
  const normalizedPath = `instagram-normalized/${key}.jpg`;
  const { error: uploadError } = await admin.storage.from(BUCKET).upload(normalizedPath, jpeg, {
    contentType: "image/jpeg",
    cacheControl: "3600",
    upsert: true,
  });
  if (uploadError) {
    throw new Error("Unable to prepare the Instagram-compatible image.");
  }

  const { data: signed, error: signedError } = await admin.storage.from(BUCKET).createSignedUrl(normalizedPath, SIGNED_URL_TTL);
  if (signedError || !signed?.signedUrl) {
    throw new Error("Unable to create the Instagram image URL.");
  }

  return {
    path: normalizedPath,
    url: signed.signedUrl,
    mimeType: "image/jpeg",
    size: jpeg.length,
  };
}
