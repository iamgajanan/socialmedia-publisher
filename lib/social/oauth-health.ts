import "server-only";

import { decryptToken } from "./token-crypto";
import { createAdminClient } from "@/lib/supabase/admin";

export type OAuthHealthStatus = "healthy" | "expiring" | "invalid" | "error";

export type FacebookOAuthHealthResult = {
  status: OAuthHealthStatus;
  httpStatus: number | null;
  tokenExpiresAt: string | null;
  errorCode: string | null;
  errorMessage: string | null;
};

type MetaErrorPayload = {
  error?: {
    code?: number;
    message?: string;
  };
};

type AccountRow = {
  id: string;
  platform: string;
  status: "connected" | "disconnected" | "error";
  token_expires_at: string | null;
  metadata: Record<string, unknown> | null;
};

function isExpiring(tokenExpiresAt: string | null, now = Date.now()) {
  if (!tokenExpiresAt) return false;
  const expiresAt = Date.parse(tokenExpiresAt);
  if (Number.isNaN(expiresAt)) return false;
  return expiresAt <= now + 7 * 24 * 60 * 60 * 1000;
}

export function classifyFacebookHealth(
  responseStatus: number,
  tokenExpiresAt: string | null,
  now = Date.now(),
  errorCode: string | null = null,
  errorMessage: string | null = null,
): FacebookOAuthHealthResult {
  if (responseStatus >= 200 && responseStatus < 300) {
    return {
      status: isExpiring(tokenExpiresAt, now) ? "expiring" : "healthy",
      httpStatus: responseStatus,
      tokenExpiresAt,
      errorCode: null,
      errorMessage: null,
    };
  }

  return {
    status: responseStatus === 401 || responseStatus === 403 ? "invalid" : "error",
    httpStatus: responseStatus,
    tokenExpiresAt,
    errorCode,
    errorMessage,
  };
}

export function buildFacebookHealthRequest(
  graphVersion: string,
  pageId: string,
) {
  const endpoint = new URL(`https://graph.facebook.com/${graphVersion}/${encodeURIComponent(pageId)}`);
  endpoint.searchParams.set("fields", "id,name");
  return endpoint;
}

async function checkFacebookAccount(
  account: AccountRow,
  accessToken: string,
  graphVersion: string,
): Promise<FacebookOAuthHealthResult> {
  const pageId = typeof account.metadata?.facebook_page_id === "string"
    ? account.metadata.facebook_page_id
    : typeof account.metadata?.meta_page_id === "string"
      ? account.metadata.meta_page_id
      : account.id;

  try {
    const response = await fetch(buildFacebookHealthRequest(graphVersion, pageId), {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });

    if (response.ok) {
      return classifyFacebookHealth(response.status, account.token_expires_at);
    }

    let errorCode: string | null = null;
    let errorMessage: string | null = null;
    try {
      const payload = (await response.json()) as MetaErrorPayload;
      errorCode = typeof payload.error?.code === "number" ? String(payload.error.code) : null;
      errorMessage = typeof payload.error?.message === "string" ? payload.error.message : null;
    } catch {
      // Keep the health result useful even when Meta returns a non-JSON body.
    }

    return classifyFacebookHealth(
      response.status,
      account.token_expires_at,
      Date.now(),
      errorCode,
      errorMessage,
    );
  } catch (error) {
    return {
      status: "error",
      httpStatus: null,
      tokenExpiresAt: account.token_expires_at,
      errorCode: null,
      errorMessage: error instanceof Error ? error.message : "Facebook health check failed.",
    };
  }
}

export async function runFacebookOAuthHealthChecks() {
  const graphVersion = process.env.META_GRAPH_VERSION?.trim();
  if (!graphVersion) throw new Error("META_GRAPH_VERSION is required for Facebook OAuth health checks.");

  const admin = createAdminClient();
  const { data: accounts, error: accountsError } = await admin
    .from("socialmedia_social_accounts")
    .select("id, platform, status, token_expires_at, metadata")
    .eq("platform", "facebook")
    .in("status", ["connected", "error"]);

  if (accountsError) throw new Error(`Facebook OAuth account lookup failed: ${accountsError.message}`);

  let checked = 0;
  let healthy = 0;
  let expiring = 0;
  let invalid = 0;
  let errors = 0;

  for (const account of (accounts ?? []) as AccountRow[]) {
    const { data: secret, error: secretError } = await admin
      .from("socialmedia_account_secrets")
      .select("access_token_ciphertext")
      .eq("social_account_id", account.id)
      .maybeSingle();

    let result: FacebookOAuthHealthResult;
    if (secretError || !secret?.access_token_ciphertext) {
      result = {
        status: "error",
        httpStatus: null,
        tokenExpiresAt: account.token_expires_at,
        errorCode: secretError?.code ?? "MISSING_TOKEN",
        errorMessage: secretError?.message ?? "Encrypted Facebook access token is missing.",
      };
    } else {
      try {
        result = await checkFacebookAccount(
          account,
          decryptToken(secret.access_token_ciphertext),
          graphVersion,
        );
      } catch (error) {
        result = {
          status: "error",
          httpStatus: null,
          tokenExpiresAt: account.token_expires_at,
          errorCode: "TOKEN_DECRYPTION_FAILED",
          errorMessage: error instanceof Error ? error.message : "Facebook access token could not be decrypted.",
        };
      }
    }

    const { error: insertError } = await admin
      .from("socialmedia_oauth_health_checks")
      .insert({
        social_account_id: account.id,
        status: result.status,
        checked_at: new Date().toISOString(),
        token_expires_at: result.tokenExpiresAt,
        http_status: result.httpStatus,
        error_code: result.errorCode,
        error_message: result.errorMessage,
        metadata: { provider: "facebook" },
      });

    if (insertError) throw new Error(`OAuth health result save failed: ${insertError.message}`);

    const nextAccountStatus = result.status === "invalid" || result.status === "error" ? "error" : "connected";
    const { error: updateError } = await admin
      .from("socialmedia_social_accounts")
      .update({ status: nextAccountStatus })
      .eq("id", account.id);

    if (updateError) throw new Error(`OAuth account status update failed: ${updateError.message}`);

    checked += 1;
    if (result.status === "healthy") healthy += 1;
    if (result.status === "expiring") expiring += 1;
    if (result.status === "invalid") invalid += 1;
    if (result.status === "error") errors += 1;
  }

  return { checked, healthy, expiring, invalid, errors };
}
