import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { MediaAsset } from "./providers/types";
const BUCKET = "social-media-assets";
const SIGNED_URL_TTL = 60 * 30;
function mimeFromPath(path: string) {
  const lower = path.toLowerCase();
  if (lower.endsWith(".mp4")) return "video/mp4";
  if (lower.endsWith(".mov")) return "video/quicktime";
  if (lower.endsWith(".webm")) return "video/webm";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".avif")) return "image/avif";
  if (lower.endsWith(".tif") || lower.endsWith(".tiff")) return "image/tiff";
  if (lower.endsWith(".bmp")) return "image/bmp";
  return "application/octet-stream";
}
export async function resolveMedia(paths: string[]): Promise<MediaAsset[]> {
  if (!paths.length) return [];
  const admin = createAdminClient();
  const assets: MediaAsset[] = [];
  for (const path of paths) {
    const { data, error } = await admin.storage.from(BUCKET).createSignedUrl(path, SIGNED_URL_TTL);
    if (error || !data?.signedUrl) throw new Error(`Unable to create a media URL for ${path}.`);
    assets.push({ path, url: data.signedUrl, mimeType: mimeFromPath(path), size: 0 });
  }
  return assets;
}
