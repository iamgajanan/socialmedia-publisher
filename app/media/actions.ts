"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const BUCKET = "social-media-assets";

async function requireUser() {
  const supabase = await createClient();
  const { data: claims, error } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (error || !userId) throw new Error("Your session has expired. Please sign in again.");
  return String(userId);
}

function ownedPath(userId: string, path: string) {
  return path.startsWith(`${userId}/`) && !path.includes("..");
}

export async function createMediaPreviewUrl(path: string) {
  const userId = await requireUser();
  if (!ownedPath(userId, path)) throw new Error("You do not have access to this media file.");

  const admin = createAdminClient();
  const { data, error } = await admin.storage.from(BUCKET).createSignedUrl(path, 3600);
  if (error || !data?.signedUrl) throw new Error(error?.message ?? "This media file could not be previewed.");
  return { signedUrl: data.signedUrl };
}

export async function deleteMediaFile(path: string) {
  const userId = await requireUser();
  if (!ownedPath(userId, path)) throw new Error("You do not have access to this media file.");

  const admin = createAdminClient();
  const { error } = await admin.storage.from(BUCKET).remove([path]);
  if (error) throw new Error(error.message);
  return { ok: true };
}
