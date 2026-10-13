import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptToken, encryptToken } from "@/lib/social/token-crypto";
import { reencryptOAuthTokenPair } from "@/lib/social/token-reencryption-core";
import { getUsableAccessToken } from "@/lib/publishing/refresh";
import { getPublisher } from "@/lib/publishing/providers";
import { PublisherError, type PublisherAccount } from "@/lib/publishing/providers/types";
import { syncAnalyticsForProfile } from "@/lib/analytics/sync";

export const maxDuration = 60;

function authorized(request: Request) {
  const secret = process.env.OAUTH_TOKEN_ROTATION_SECRET;
  if (!secret) return false;
  const actual = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function errorCode(error: unknown) {
  if (error instanceof PublisherError) return error.code;
  if (error instanceof Error && error.message.includes("token_refresh_failed")) return "token_refresh_failed";
  return "provider_request_failed";
}

async function runAnalyticsAcceptance(admin: ReturnType<typeof createAdminClient>) {
  const { data: profiles, error } = await admin.from("socialmedia_profiles").select("id");
  if (error) return NextResponse.json({ ok: false, error: "Unable to load analytics profiles." }, { status: 500 });

  const runs: Array<{ runId: string; accountsScanned: number; accountsSucceeded: number; accountsFailed: number; postsScanned: number; metricsWritten: number; warnings: number }> = [];
  for (const profile of profiles ?? []) {
    const startedAt = new Date().toISOString();
    const { data: run, error: runError } = await admin
      .from("socialmedia_analytics_sync_runs")
      .insert({ profile_id: profile.id, status: "running", started_at: startedAt })
      .select("id")
      .maybeSingle();
    if (runError || !run?.id) {
      runs.push({ runId: "not-created", accountsScanned: 0, accountsSucceeded: 0, accountsFailed: 1, postsScanned: 0, metricsWritten: 0, warnings: 0 });
      continue;
    }
    try {
      const result = await syncAnalyticsForProfile(profile.id, run.id);
      runs.push({
        runId: run.id,
        accountsScanned: result.results.length,
        accountsSucceeded: result.results.filter((item) => item.ok).length,
        accountsFailed: result.results.filter((item) => !item.ok).length,
        postsScanned: result.results.reduce((total, item) => total + item.postsScanned, 0),
        metricsWritten: result.results.reduce((total, item) => total + item.metricsWritten, 0),
        warnings: result.results.filter((item) => item.warning).length,
      });
    } catch {
      await admin.from("socialmedia_analytics_sync_runs").update({
        status: "failed",
        finished_at: new Date().toISOString(),
        error_count: 1,
        errors: [{ error: "analytics_sync_failed" }],
      }).eq("id", run.id);
      runs.push({ runId: run.id, accountsScanned: 0, accountsSucceeded: 0, accountsFailed: 1, postsScanned: 0, metricsWritten: 0, warnings: 0 });
    }
  }

  return NextResponse.json({
    ok: runs.every((run) => run.accountsFailed === 0),
    analytics: {
      profilesScanned: runs.length,
      accountsScanned: runs.reduce((total, run) => total + run.accountsScanned, 0),
      accountsSucceeded: runs.reduce((total, run) => total + run.accountsSucceeded, 0),
      accountsFailed: runs.reduce((total, run) => total + run.accountsFailed, 0),
      postsScanned: runs.reduce((total, run) => total + run.postsScanned, 0),
      metricsWritten: runs.reduce((total, run) => total + run.metricsWritten, 0),
      warnings: runs.reduce((total, run) => total + run.warnings, 0),
      runs,
    },
  });
}

export async function POST(request: Request) {
  if (!process.env.OAUTH_TOKEN_ROTATION_SECRET) {
    return NextResponse.json({ ok: false, error: "rotation_acceptance_not_configured" }, { status: 503 });
  }
  if (!authorized(request)) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!process.env.SOCIAL_OAUTH_ENCRYPTION_KEY) {
    return NextResponse.json({ ok: false, error: "dedicated_encryption_key_not_configured" }, { status: 503 });
  }

  const admin = createAdminClient();
  const body = await request.json().catch(() => ({})) as { action?: string };
  if (body.action === "analytics-sync") return runAnalyticsAcceptance(admin);
  const { data: secrets, error: secretsError } = await admin
    .from("socialmedia_account_secrets")
    .select("social_account_id,access_token_ciphertext,refresh_token_ciphertext,updated_at")
    .order("updated_at", { ascending: true })
    .limit(1000);

  if (secretsError) return NextResponse.json({ ok: false, error: "Unable to load OAuth ciphertext rows." }, { status: 500 });

  let rewritten = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of secrets ?? []) {
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

  const { data: accounts, error: accountsError } = await admin
    .from("socialmedia_social_accounts")
    .select("id,platform,external_account_id,account_name,username,metadata,token_expires_at")
    .eq("status", "connected");

  if (accountsError) {
    return NextResponse.json({
      ok: false,
      rotation: { scanned: secrets?.length ?? 0, rewritten, skipped, failed },
      providerSmoke: { ok: false, error: "Unable to load connected accounts." },
    }, { status: 500 });
  }

  const results: Array<{ accountId: string; platform: string; ok: boolean; identityMatched: boolean | null; errorCode?: string }> = [];
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
      results.push({
        accountId: account.id,
        platform: account.platform,
        ok: true,
        identityMatched: returnedId ? returnedId === account.external_account_id : null,
      });
    } catch (error) {
      results.push({
        accountId: account.id,
        platform: account.platform,
        ok: false,
        identityMatched: null,
        errorCode: errorCode(error),
      });
    }
  }

  const providerSmoke = {
    checked: results.length,
    passed: results.filter((result) => result.ok).length,
    failed: results.filter((result) => !result.ok).length,
    results,
  };
  return NextResponse.json({
    ok: failed === 0 && skipped === 0,
    rotation: { scanned: secrets?.length ?? 0, rewritten, skipped, failed },
    providerSmoke,
    note: "This one-time endpoint performs read-only provider profile checks; it never publishes content or returns token material.",
  });
}
