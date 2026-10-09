import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { hashApiKey, isApiKey, normalizeApiKey } from "./api-key-core";

export type ApiAuthenticationResult =
  | { ok: true; profileId: string; apiKeyId: string; workspaceId: string }
  | { ok: false; status: 401 | 429 | 503; error: string; retryAfterSeconds?: number };

function isMissingWorkspaceColumn(error: { code?: string; message?: string } | null | undefined) {
  return Boolean(error && (error.code === "PGRST204" || error.code === "42703") && /workspace_id/i.test(error.message ?? ""));
}

export async function authenticateApiRequest(request: Request): Promise<ApiAuthenticationResult> {
  const authorization = request.headers.get("authorization")?.trim() ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) return { ok: false, status: 401, error: "Bearer API key required." };

  const token = normalizeApiKey(match[1] ?? "");
  if (!isApiKey(token)) return { ok: false, status: 401, error: "Invalid API key." };

  const admin = createAdminClient();
  let { data, error } = await admin
    .from("socialmedia_api_keys")
    .select("id, profile_id, workspace_id, revoked_at, last_used_at")
    .eq("token_hash", hashApiKey(token))
    .maybeSingle();

  if (isMissingWorkspaceColumn(error)) {
    // Older production schemas store API keys per profile. Resolve that profile's
    // workspace explicitly rather than accepting a caller-supplied tenant ID.
    const legacyResult = await admin
      .from("socialmedia_api_keys")
      .select("id, profile_id, revoked_at, last_used_at")
      .eq("token_hash", hashApiKey(token))
      .maybeSingle();
    data = legacyResult.data;
    error = legacyResult.error;
    if (!error && data) {
      const profileResult = await admin
        .from("socialmedia_profiles")
        .select("workspace_id")
        .eq("id", String(data.profile_id))
        .maybeSingle();
      if (profileResult.error) {
        console.error("api_auth_profile_workspace_lookup_failed", { code: profileResult.error.code, message: profileResult.error.message });
        return { ok: false, status: 503, error: "API workspace lookup is temporarily unavailable." };
      }
      data = data ? { ...data, workspace_id: profileResult.data?.workspace_id ?? null } : data;
    }
  }

  if (error) {
    console.error("api_auth_lookup_failed", { code: error.code, message: error.message });
    return { ok: false, status: 401, error: "Invalid API key." };
  }

  if (!data || data.revoked_at) return { ok: false, status: 401, error: "Invalid or revoked API key." };

  const profileId = String(data.profile_id);
  const apiKeyId = String(data.id);
  const workspaceId = String(data.workspace_id ?? "");
  if (!workspaceId) return { ok: false, status: 401, error: "API key is not attached to a workspace." };

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
      workspaceId,
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

  const periodStart = new Date();
  periodStart.setUTCDate(1);
  const { error: usageError } = await admin.rpc("socialmedia_record_api_request", {
    target_workspace_id: workspaceId,
    target_period_start: periodStart.toISOString().slice(0, 10),
  });
  if (usageError) {
    // Usage tracking was added with Phase 32; it is non-blocking for API access.
    console.error("api_usage_record_failed", {
      apiKeyId,
      workspaceId,
      code: usageError.code,
      message: usageError.message,
    });
  }

  const lastUsedAt = data.last_used_at ? new Date(String(data.last_used_at)).getTime() : 0;
  if (!lastUsedAt || Date.now() - lastUsedAt >= 5 * 60 * 1000) {
    let updateResult = await admin
      .from("socialmedia_api_keys")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", apiKeyId)
      .eq("workspace_id", workspaceId)
      .is("revoked_at", null);

    if (isMissingWorkspaceColumn(updateResult.error)) {
      updateResult = await admin
        .from("socialmedia_api_keys")
        .update({ last_used_at: new Date().toISOString() })
        .eq("id", apiKeyId)
        .eq("profile_id", profileId)
        .is("revoked_at", null);
    }

    if (updateResult.error) {
      console.error("api_auth_last_used_update_failed", {
        apiKeyId,
        profileId,
        workspaceId,
        code: updateResult.error.code,
        message: updateResult.error.message,
      });
    }
  }

  return { ok: true, profileId, apiKeyId, workspaceId };
}
