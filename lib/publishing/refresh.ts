import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptToken, encryptToken } from "@/lib/social/token-crypto";
import { getPublisher } from "./providers";
import type { PublisherAccount } from "./providers/types";
export async function getUsableAccessToken(account: PublisherAccount) {
  const admin = createAdminClient();
  const { data: secrets, error: secretError } = await admin.from("socialmedia_account_secrets").select("access_token_ciphertext,refresh_token_ciphertext").eq("social_account_id", account.id).maybeSingle();
  if (secretError) throw new Error(`Unable to load social account secrets: ${secretError.message}`);
  if (!secrets?.access_token_ciphertext) throw new Error("This social account has no stored access token.");
  const current = decryptToken(secrets.access_token_ciphertext);
  const expiresAt = account.token_expires_at ? Date.parse(account.token_expires_at) : Number.POSITIVE_INFINITY;
  if (expiresAt > Date.now() + 120_000) return current;
  if (!secrets.refresh_token_ciphertext) return current;
  const publisher = getPublisher(account.platform); if (!publisher.refreshToken) return current;
  const refreshed = await publisher.refreshToken(account, decryptToken(secrets.refresh_token_ciphertext)); if (!refreshed) return current;
  const { error: secretUpdateError } = await admin.from("socialmedia_account_secrets").update({ access_token_ciphertext: encryptToken(refreshed.accessToken), updated_at: new Date().toISOString() }).eq("social_account_id", account.id);
  if (secretUpdateError) throw new Error(`Unable to persist refreshed access token: ${secretUpdateError.message}`);
  const { error } = await admin.from("socialmedia_social_accounts").update({ token_expires_at: refreshed.expiresIn ? new Date(Date.now() + refreshed.expiresIn * 1000).toISOString() : null, status: "connected" }).eq("id", account.id);
  if (error) throw new Error(`Unable to persist refreshed access token: ${error.message}`);
  return refreshed.accessToken;
}
