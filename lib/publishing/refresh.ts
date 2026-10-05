import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptToken, encryptToken } from "@/lib/social/token-crypto";
import { getPublisher } from "./providers";
import { PublisherError } from "./providers/types";
import type { PublisherAccount, RefreshResult } from "./providers/types";

export async function getUsableAccessToken(account: PublisherAccount) {
  const admin = createAdminClient();
  const { data: secrets, error: secretError } = await admin.from("socialmedia_account_secrets").select("access_token_ciphertext,refresh_token_ciphertext").eq("social_account_id", account.id).maybeSingle();
  if (secretError) throw new Error(`Unable to load social account secrets: ${secretError.message}`);
  if (!secrets?.access_token_ciphertext) throw new PublisherError("This social account has no stored access token.", { code: "token_missing" });
  const current = decryptToken(secrets.access_token_ciphertext);
  const expiresAt = account.token_expires_at ? Date.parse(account.token_expires_at) : Number.POSITIVE_INFINITY;
  if (expiresAt > Date.now() + 120_000) return current;
  const publisher = getPublisher(account.platform);
  if (publisher.refreshAccessToken) {
    const refreshed = await publisher.refreshAccessToken(account, current);
    if (refreshed) { await persistRefreshedToken(admin, account.id, refreshed); return refreshed.accessToken; }
  }
  if (!secrets.refresh_token_ciphertext || !publisher.refreshToken) return current;
  const refreshed = await publisher.refreshToken(account, decryptToken(secrets.refresh_token_ciphertext));
  if (!refreshed) throw new PublisherError("The provider rejected the token refresh.", { code: "token_refresh_failed" });
  await persistRefreshedToken(admin, account.id, refreshed);
  return refreshed.accessToken;
}

async function persistRefreshedToken(admin: ReturnType<typeof createAdminClient>, accountId: string, refreshed: RefreshResult) {
  const update: { access_token_ciphertext: string; refresh_token_ciphertext?: string; updated_at: string } = { access_token_ciphertext: encryptToken(refreshed.accessToken), updated_at: new Date().toISOString() };
  if (refreshed.refreshToken) update.refresh_token_ciphertext = encryptToken(refreshed.refreshToken);
  const { error: secretUpdateError } = await admin.from("socialmedia_account_secrets").update(update).eq("social_account_id", accountId);
  if (secretUpdateError) throw new Error(`Unable to persist refreshed access token: ${secretUpdateError.message}`);
  const { error } = await admin.from("socialmedia_social_accounts").update({ token_expires_at: refreshed.expiresIn ? new Date(Date.now() + refreshed.expiresIn * 1000).toISOString() : null, status: "connected" }).eq("id", accountId);
  if (error) throw new Error(`Unable to persist refreshed access token: ${error.message}`);
}
