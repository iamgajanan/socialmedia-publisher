"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { decryptToken, encryptToken } from "@/lib/social/token-crypto";
import { getProviderConfig } from "@/lib/social/oauth";
import { getPublisher } from "@/lib/publishing/providers";
import type { PublisherAccount } from "@/lib/publishing/providers/types";
import { enqueueNotification } from "@/lib/notifications";

async function requireUser() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) redirect("/auth/login");
  return { userId: String(data.claims.sub) };
}

export async function disconnectAccount(accountId: string) {
  const { userId } = await requireUser();
  const admin = createAdminClient();
  const { data: account } = await admin.from("socialmedia_social_accounts").select("id,platform,account_name,created_at").eq("id", accountId).eq("profile_id", userId).maybeSingle();
  if (account) await enqueueNotification({ profileId: userId, eventType: "account_disconnected", dedupeKey: `account_disconnected:${account.id}:${account.created_at}`, socialAccountId: account.id, payload: { platform: account.platform, account: account.account_name } });
  const { error } = await admin.from("socialmedia_social_accounts").delete().eq("id", accountId).eq("profile_id", userId);
  if (error) redirect("/connect-accounts?error=disconnect");
  redirect("/connect-accounts?disconnected=1");
}

export async function refreshAccount(accountId: string) {
  const { userId } = await requireUser();
  const admin = createAdminClient();
  const { data: account, error: accountError } = await admin.from("socialmedia_social_accounts")
    .select("id,platform,external_account_id,account_name,username,metadata,token_expires_at")
    .eq("id", accountId).eq("profile_id", userId).maybeSingle();
  if (accountError || !account) redirect("/connect-accounts?error=refresh");

  const { data: secrets, error: secretsError } = await admin.from("socialmedia_account_secrets")
    .select("access_token_ciphertext,refresh_token_ciphertext")
    .eq("social_account_id", accountId).maybeSingle();
  if (secretsError || !secrets?.access_token_ciphertext) redirect(`/connect-accounts?error=refresh&platform=${account.platform}`);

  const publisher = getPublisher(account.platform);
  const publisherAccount = account as PublisherAccount;
  const currentAccessToken = decryptToken(secrets.access_token_ciphertext);
  let refreshed: { accessToken: string; expiresIn?: number } | null = null;

  if (publisher.refreshAccessToken) {
    refreshed = await publisher.refreshAccessToken(publisherAccount, currentAccessToken);
  } else if (publisher.refreshToken && secrets.refresh_token_ciphertext) {
    refreshed = await publisher.refreshToken(publisherAccount, decryptToken(secrets.refresh_token_ciphertext));
  }

  if (!refreshed && secrets.refresh_token_ciphertext) {
    const config = getProviderConfig(account.platform as Parameters<typeof getProviderConfig>[0]);
    if (!config) redirect(`/connect-accounts?error=setup&platform=${account.platform}`);
    const refreshToken = decryptToken(secrets.refresh_token_ciphertext);
    const body = new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken });
    if (config.tokenClientKey) { body.set(config.tokenClientKey, config.clientId); body.set("client_secret", config.clientSecret); }
    else { body.set("client_id", config.clientId); if (!config.clientSecretInBasicAuth) body.set("client_secret", config.clientSecret); }
    const headers: HeadersInit = { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" };
    if (config.clientSecretInBasicAuth) headers.Authorization = `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64")}`;
    const response = await fetch(config.tokenUrl, { method: "POST", headers, body, cache: "no-store" });
    if (!response.ok) {
      await admin.from("socialmedia_social_accounts").update({ status: "error" }).eq("id", accountId).eq("profile_id", userId);
      redirect(`/connect-accounts?error=refresh&platform=${account.platform}`);
    }
    const tokens = (await response.json()) as { access_token?: string; refresh_token?: string; expires_in?: number; refresh_expires_in?: number; scope?: string };
    if (!tokens.access_token) redirect(`/connect-accounts?error=refresh&platform=${account.platform}`);
    refreshed = { accessToken: tokens.access_token, expiresIn: tokens.expires_in };
    const { error: secretUpdateError } = await admin.from("socialmedia_account_secrets").update({
      access_token_ciphertext: encryptToken(tokens.access_token),
      refresh_token_ciphertext: tokens.refresh_token ? encryptToken(tokens.refresh_token) : secrets.refresh_token_ciphertext,
      updated_at: new Date().toISOString(),
    }).eq("social_account_id", accountId);
    if (secretUpdateError) redirect(`/connect-accounts?error=refresh&platform=${account.platform}`);
    const { error: accountUpdateError } = await admin.from("socialmedia_social_accounts").update({
      status: "connected",
      token_expires_at: typeof tokens.expires_in === "number" ? new Date(Date.now() + tokens.expires_in * 1000).toISOString() : null,
      refresh_token_expires_at: typeof tokens.refresh_expires_in === "number" ? new Date(Date.now() + tokens.refresh_expires_in * 1000).toISOString() : null,
      ...(tokens.scope ? { scopes: tokens.scope.split(/[ ,]+/).filter(Boolean) } : {}),
    }).eq("id", accountId).eq("profile_id", userId);
    if (accountUpdateError) redirect(`/connect-accounts?error=refresh&platform=${account.platform}`);
  } else if (refreshed) {
    const { error: secretUpdateError } = await admin.from("socialmedia_account_secrets").update({
      access_token_ciphertext: encryptToken(refreshed.accessToken),
      updated_at: new Date().toISOString(),
    }).eq("social_account_id", accountId);
    if (secretUpdateError) redirect(`/connect-accounts?error=refresh&platform=${account.platform}`);
    const { error: accountUpdateError } = await admin.from("socialmedia_social_accounts").update({
      status: "connected",
      token_expires_at: typeof refreshed.expiresIn === "number" ? new Date(Date.now() + refreshed.expiresIn * 1000).toISOString() : null,
    }).eq("id", accountId).eq("profile_id", userId);
    if (accountUpdateError) redirect(`/connect-accounts?error=refresh&platform=${account.platform}`);
  } else {
    redirect(`/connect-accounts?error=refresh&platform=${account.platform}`);
  }
  revalidatePath("/connect-accounts");
}
