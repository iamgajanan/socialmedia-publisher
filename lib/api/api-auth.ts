import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { hashApiKey, isApiKey, normalizeApiKey } from "./api-key-core";

export type ApiAuthenticationResult =
  | { ok: true; profileId: string; apiKeyId: string }
  | { ok: false; status: 401 | 429 | 503; error: string; retryAfterSeconds?: number };

export async function authenticateApiRequest(request: Request): Promise<ApiAuthenticationResult> {
  const authorization = request.headers.get("authorization")?.trim() ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) return { ok: false, status: 401, error: "Bearer API key required." };

  const token = normalizeApiKey(match[1] ?? "");
  if (!isApiKey(token)) return { ok: false, status: 401, error: "Invalid API key." };

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("socialmedia_api_keys")
    .select("id, profile_id, revoked_at, last_used_at")
    .eq("token_hash", hashApiKey(token))
    .maybeSingle();

  if (error) {
    console.error("api_auth_lookup_failed", { code: error.code, message: error.message });
    return { ok: false, status: 401, error: "Invalid API key." };
  }

  if (!data || data.revoked_at) return { ok: false, status: 401, error: "Invalid or revoked API key." };

  const profileId = String(data.profile_id);
  const apiKeyId = String(data.id);

  const { data: rateLimit, error: rateLimitError } = await admin.rpc(
    "socialmedia_consume_api_rate_limit",
    {
      p_api_key_id: apiKeyId,
      p_profile_id: profileId,
      p_limit: 120,
      p_window_seconds: 60,
    },
  );

  if (rateLimitError) {
    console.error("api_rate_limit_check_failed", {
      apiKeyId,
      profileId,
      code: rateLimitError.code,
      message: rateLimitError.message,
    });
    return { ok: false, status: 503, error: "API protection is temporarily unavailable." };
  }

  const limit = Array.isArray(rateLimit) ? rateLimit[0] : rateLimit;
  if (limit && limit.allowed === false) {
    return {
      ok: false,
      status: 429,
      error: "API rate limit exceeded. Please retry shortly.",
      retryAfterSeconds: Number(limit.retry_after_seconds ?? 60),
    };
  }

  const lastUsedAt = data.last_used_at ? new Date(String(data.last_used_at)).getTime() : 0;
  if (!lastUsedAt || Date.now() - lastUsedAt >= 5 * 60 * 1000) {
    const { error: updateError } = await admin
      .from("socialmedia_api_keys")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", apiKeyId)
      .eq("profile_id", profileId)
      .is("revoked_at", null);

    if (updateError) {
      console.error("api_auth_last_used_update_failed", {
        apiKeyId,
        profileId,
        code: updateError.code,
        message: updateError.message,
      });
    }
  }

  return { ok: true, profileId, apiKeyId };
}
