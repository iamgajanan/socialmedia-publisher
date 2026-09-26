"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { decryptToken, encryptToken } from "@/lib/social/token-crypto";
import { getProviderConfig } from "@/lib/social/oauth";

async function requireUser() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) redirect("/auth/login");
  return { userId: String(data.claims.sub) };
}

export async function disconnectAccount(accountId: string) {
  const { userId } = await requireUser();
  const admin = createAdminClient();
  const { error } = await admin.from("socialmedia_social_accounts").delete().eq("id", accountId).eq("profile_id", userId);
  if (error) redirect("/connect-accounts?error=disconnect");
  redirect("/connect-accounts?disconnected=1");
}

export async function refreshAccount(accountId: string) {
  const { userId } = await requireUser();
  const admin = createAdminClient();
  const { data: account, error } = await admin.from("socialmedia_social_accounts").select("id,platform,profile_id,refresh_token_ciphertext").eq("id", accountId).eq("profile_id", userId).maybeSingle();
  if (error || !account?.refresh_token_ciphertext) redirect("/connect-accounts?error=refresh");

  const config = getProviderConfig(account.platform as Parameters<typeof getProviderConfig>[0]);
  if (!config) redirect(`/connect-accounts?error=setup&platform=${account.platform}`);

  const refreshToken = decryptToken(account.refresh_token_ciphertext);
  const body = new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken });
  if (config.tokenClientKey) {
    body.set(config.tokenClientKey, config.clientId);
    body.set("client_secret", config.clientSecret);
  } else {
    body.set("client_id", config.clientId);
    if (!config.clientSecretInBasicAuth) body.set("client_secret", config.clientSecret);
  }

  const headers: HeadersInit = { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" };
  if (config.clientSecretInBasicAuth) headers.Authorization = `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64")}`;

  const response = await fetch(config.tokenUrl, { method: "POST", headers, body, cache: "no-store" });
  if (!response.ok) {
    await admin.from("socialmedia_social_accounts").update({ status: "error" }).eq("id", accountId).eq("profile_id", userId);
    redirect(`/connect-accounts?error=refresh&platform=${account.platform}`);
  }

  const tokens = (await response.json()) as { access_token?: string; refresh_token?: string; expires_in?: number; refresh_expires_in?: number; scope?: string };
  if (!tokens.access_token) redirect(`/connect-accounts?error=refresh&platform=${account.platform}`);

  const update: Record<string, unknown> = {
    status: "connected",
    access_token_ciphertext: encryptToken(tokens.access_token),
    refresh_token_ciphertext: tokens.refresh_token ? encryptToken(tokens.refresh_token) : account.refresh_token_ciphertext,
    token_expires_at: typeof tokens.expires_in === "number" ? new Date(Date.now() + tokens.expires_in * 1000).toISOString() : null,
    refresh_token_expires_at: typeof tokens.refresh_expires_in === "number" ? new Date(Date.now() + tokens.refresh_expires_in * 1000).toISOString() : null,
  };
  if (tokens.scope) update.scopes = tokens.scope.split(/[ ,]+/).filter(Boolean);

  const { error: updateError } = await admin.from("socialmedia_social_accounts").update(update).eq("id", accountId).eq("profile_id", userId);
  if (updateError) redirect(`/connect-accounts?error=refresh&platform=${account.platform}`);
  revalidatePath("/connect-accounts");
}
