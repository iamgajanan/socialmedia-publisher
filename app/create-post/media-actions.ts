"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const BUCKET = "social-media-assets";

function safeFileName(name: string) {
  const cleaned = name.normalize("NFKC").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  return cleaned.slice(-120) || "media";
}

export async function createMediaUploadUrl(fileName: string) {
  const supabase = await createClient();
  const { data: claims, error: claimsError } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;

  if (claimsError || !userId) {
    throw new Error("Your session has expired. Please sign in again.");
  }

  const path = `${String(userId)}/${crypto.randomUUID()}-${safeFileName(fileName)}`;
  const admin = createAdminClient();
  const { data, error } = await admin.storage.from(BUCKET).createSignedUploadUrl(path);

  if (error || !data?.signedUrl) {
    throw new Error(error?.message ?? "Could not prepare the media upload.");
  }

  return { path, signedUrl: data.signedUrl };
}
