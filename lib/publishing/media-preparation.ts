import "server-only";

import { createHash } from "node:crypto";
import sharp from "sharp";
import { createAdminClient } from "@/lib/supabase/admin";
import type { MediaAsset } from "./providers/types";

const BUCKET = "social-media-assets";
const DERIVED_URL_TTL = 60 * 30;
const INSTAGRAM_MIN_RATIO = 4 / 5;
const INSTAGRAM_MAX_RATIO = 1.91;
const INSTAGRAM_MAX_WIDTH = 1440;
const INSTAGRAM_PORTRAIT_WIDTH = 1080;
const INSTAGRAM_PORTRAIT_HEIGHT = 1350;
const INSTAGRAM_LANDSCAPE_WIDTH = 1440;
const INSTAGRAM_LANDSCAPE_HEIGHT = 754;

function isImage(media: MediaAsset) {
  return media.mimeType.startsWith("image/");
}

function derivedPath(media: MediaAsset) {
  const key = createHash("sha256").update(media.path).digest("hex").slice(0, 24);
  return `derived/instagram/${key}.jpg`;
}

/**
 * Instagram's image publishing endpoint expects a remotely fetchable JPEG
 * and rejects portrait/landscape ratios outside its supported feed range.
 * Normalize only for Instagram so other destinations keep the original asset.
 */
async function prepareInstagramImage(media: MediaAsset): Promise<MediaAsset> {
  const response = await fetch(media.url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Unable to download media for Instagram (${response.status}).`);
  }

  const source = Buffer.from(await response.arrayBuffer());
  const metadata = await sharp(source).metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  if (!width || !height) {
    throw new Error("Instagram could not determine the image dimensions.");
  }

  const ratio = width / height;
  let output: Buffer;

  if (ratio < INSTAGRAM_MIN_RATIO) {
    output = await sharp(source)
      .autoOrient()
      .resize(INSTAGRAM_PORTRAIT_WIDTH, INSTAGRAM_PORTRAIT_HEIGHT, {
        fit: "contain",
        background: "#ffffff",
      })
      .jpeg({ quality: 88, mozjpeg: true })
      .toBuffer();
  } else if (ratio > INSTAGRAM_MAX_RATIO) {
    output = await sharp(source)
      .autoOrient()
      .resize(INSTAGRAM_LANDSCAPE_WIDTH, INSTAGRAM_LANDSCAPE_HEIGHT, {
        fit: "contain",
        background: "#ffffff",
      })
      .jpeg({ quality: 88, mozjpeg: true })
      .toBuffer();
  } else {
    output = await sharp(source)
      .autoOrient()
      .resize({
        width: INSTAGRAM_MAX_WIDTH,
        height: INSTAGRAM_PORTRAIT_HEIGHT,
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: 88, mozjpeg: true })
      .toBuffer();
  }

  const admin = createAdminClient();
  const path = derivedPath(media);
  const { error: uploadError } = await admin.storage.from(BUCKET).upload(path, output, {
    contentType: "image/jpeg",
    cacheControl: "3600",
    upsert: true,
  });
  if (uploadError) {
    throw new Error(`Unable to store the Instagram-ready image: ${uploadError.message}`);
  }

  const { data, error: urlError } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(path, DERIVED_URL_TTL);
  if (urlError || !data?.signedUrl) {
    throw new Error("Unable to create the Instagram-ready image URL.");
  }

  return {
    path,
    url: data.signedUrl,
    mimeType: "image/jpeg",
    size: output.byteLength,
  };
}

export async function prepareMediaForPlatform(
  platform: string,
  media: MediaAsset[],
): Promise<MediaAsset[]> {
  if (platform !== "instagram") return media;
  return Promise.all(media.map((asset) => (isImage(asset) ? prepareInstagramImage(asset) : asset)));
}
