import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { hashApiKey, isApiKey, normalizeApiKey } from "./api-key-core";

export type ApiAuthenticationResult =
  | { ok: true; profileId: string; apiKeyId: string }
  | { ok: false; status: 401; error: string };

export async function authenticateApiRequest(request: Request): Promise<ApiAuthenticationResult> {
  const authorization = request.headers.get("authorization")?.trim() ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) return { ok: false, status: 401, error: "Bearer API key required." };

  const token = normalizeApiKey(match[1] ?? "");
  if (!isApiKey(token)) return { ok: false, status: 401, error: "Invalid API key." };

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("socialmedia_api_keys")
    .select("id, profile_id, revoked_at")
    .eq("token_hash", hashApiKey(token))
    .maybeSingle();

  if (error) {
    console.error("api_auth_lookup_failed", { code: error.code, message: error.message });
    return { ok: false, status: 401, error: "Invalid API key." };
  }

  if (!data || data.revoked_at) return { ok: false, status: 401, error: "Invalid or revoked API key." };

  const profileId = String(data.profile_id);
  const apiKeyId = String(data.id);
  const { error: updateError } = await admin
    .from("socialmedia_api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", apiKeyId)
    .eq("profile_id", profileId)
    .is("revoked_at", null);

  if (updateError) console.error("api_auth_last_used_update_failed", { apiKeyId, profileId, code: updateError.code, message: updateError.message });

  return { ok: true, profileId, apiKeyId };
}
