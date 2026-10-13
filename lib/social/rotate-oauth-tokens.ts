import { createAdminClient } from "@/lib/supabase/admin";
import { decryptToken, encryptToken } from "@/lib/social/token-crypto";
import { reencryptOAuthTokenPair } from "@/lib/social/token-reencryption-core";
import { getUsableAccessToken } from "@/lib/publishing/refresh";
import { getPublisher } from "@/lib/publishing/providers";
import { PublisherError, type PublisherAccount } from "@/lib/publishing/providers/types";

type AdminClient = ReturnType<typeof createAdminClient>;

function providerErrorCode(error: unknown) {
  if (error instanceof PublisherError) return error.code;
  if (error instanceof Error && error.message.includes("token_refresh_failed")) return "token_refresh_failed";
  return "provider_request_failed";
}

/**
 * Runs only while the temporary production flag is enabled, and only once:
 * ciphertext rows written after the configured cutoff are treated as rotated.
 * The caller is the existing CRON_SECRET-protected analytics cron route.
 */
export async function runOAuthRotationAcceptance(admin: AdminClient) {
  if (process.env.OAUTH_TOKEN_ROTATION_ENABLED !== "true") return { enabled: false };

  const cutoff = Date.parse(process.env.OAUTH_TOKEN_ROTATION_STARTED_AT ?? "");
  if (!Number.isFinite(cutoff)) {
    return { enabled: true, ok: false, error: "rotation_cutoff_not_configured" };
  }

  const startedAt = new Date().toISOString();
  const { data: secrets, error: secretsError } = await admin
    .from("socialmedia_account_secrets")
    .select("social_account_id,access_token_ciphertext,refresh_token_ciphertext,updated_at")
    .order("updated_at", { ascending: true })
    .limit(1000);

  if (secretsError) return { enabled: true, ok: false, error: "secret_rows_lookup_failed" };

  const pending = (secrets ?? []).filter((row) => {
    const updated = Date.parse(row.updated_at ?? "");
    return !Number.isFinite(updated) || updated < cutoff;
  });
  if (pending.length === 0) return { enabled: true, alreadyCompleted: true, scanned: secrets?.length ?? 0 };

  let rewritten = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of pending) {
    try {
      const updates = reencryptOAuthTokenPair(row, { decrypt: decryptToken, encrypt: encryptToken });
      if (Object.keys(updates).length === 0) {
        skipped++;
        continue;
      }
      const { data, error } = await admin
        .from("socialmedia_account_secrets")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("social_account_id", row.social_account_id)
        .eq("updated_at", row.updated_at)
        .select("social_account_id")
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        skipped++;
        continue;
      }
      rewritten++;
    } catch {
      failed++;
    }
  }

  const rotationOk = failed === 0 && skipped === 0 && rewritten === pending.length;
  const smokeResults: Array<{ accountId: string; platform: string; ok: boolean; identityMatched: boolean | null; errorCode?: string }> = [];

  if (rotationOk) {
    const { data: accounts, error: accountsError } = await admin
      .from("socialmedia_social_accounts")
      .select("id,platform,external_account_id,account_name,username,metadata,token_expires_at")
      .eq("status", "connected");

    if (accountsError) {
      smokeResults.push({ accountId: "all", platform: "all", ok: false, identityMatched: null, errorCode: "connected_accounts_lookup_failed" });
    } else {
      for (const account of accounts ?? []) {
        try {
          const publisherAccount: PublisherAccount = {
            id: account.id,
            platform: account.platform,
            external_account_id: account.external_account_id,
            account_name: account.account_name,
            username: account.username,
            metadata: account.metadata ?? {},
            token_expires_at: account.token_expires_at,
          };
          const token = await getUsableAccessToken(publisherAccount);
          const profile = await getPublisher(account.platform).getAccount(token);
          const returnedId = typeof profile.external_account_id === "string" ? profile.external_account_id : null;
          const identityMatched = returnedId ? returnedId === account.external_account_id : null;
          smokeResults.push({
            accountId: account.id,
            platform: account.platform,
            ok: identityMatched !== false,
            identityMatched,
            ...(identityMatched === false ? { errorCode: "identity_mismatch" } : {}),
          });
        } catch (error) {
          smokeResults.push({
            accountId: account.id,
            platform: account.platform,
            ok: false,
            identityMatched: null,
            errorCode: providerErrorCode(error),
          });
        }
      }
    }
  }

  const providerSmoke = {
    checked: smokeResults.length,
    passed: smokeResults.filter((item) => item.ok).length,
    failed: smokeResults.filter((item) => !item.ok).length,
    results: smokeResults,
  };
  const result = {
    operation: "oauth_key_rotation_acceptance",
    rotation: { scanned: secrets?.length ?? 0, pending: pending.length, rewritten, skipped, failed, ok: rotationOk },
    providerSmoke,
  };
  const workerStatus = rotationOk && providerSmoke.failed === 0 ? "succeeded" : "failed";
  const { error: workerLogError } = await admin.from("socialmedia_worker_runs").insert({
    worker_type: "oauth_health",
    status: workerStatus,
    started_at: startedAt,
    finished_at: new Date().toISOString(),
    duration_ms: Math.max(0, Date.now() - Date.parse(startedAt)),
    result,
    error_message: workerStatus === "failed" ? "OAuth key rotation or live provider smoke acceptance reported failures." : null,
  });
  if (workerLogError) console.error("oauth_key_rotation_acceptance_log_failed", { code: workerLogError.code });

  console.info("oauth_key_rotation_acceptance", result);
  return { enabled: true, alreadyCompleted: false, ...result };
}
