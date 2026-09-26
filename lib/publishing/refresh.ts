import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptToken, encryptToken } from "@/lib/social/token-crypto";
import { getPublisher } from "./providers";
import type { PublisherAccount } from "./providers/types";
export async function getUsableAccessToken(account: PublisherAccount) {
  if (!account.access_token_ciphertext) throw new Error("This social account has no stored access token.");
  const current = decryptToken(account.access_token_ciphertext);
  const expiresAt = account.token_expires_at ? Date.parse(account.token_expires_at) : Number.POSITIVE_INFINITY;
  if (expiresAt > Date.now() + 120_000) return current;
  if (!account.refresh_token_ciphertext) return current;
  const publisher = getPublisher(account.platform); if (!publisher.refreshToken) return current;
  const refreshed = await publisher.refreshToken(account, decryptToken(account.refresh_token_ciphertext)); if (!refreshed) return current;
  const admin = createAdminClient();
  const { error } = await admin.from("socialmedia_social_accounts").update({ access_token_ciphertext: encryptToken(refreshed.accessToken), token_expires_at: refreshed.expiresIn ? new Date(Date.now() + refreshed.expiresIn * 1000).toISOString() : null, status: "connected" }).eq("id", account.id);
  if (error) throw new Error(`Unable to persist refreshed access token: ${error.message}`);
  return refreshed.accessToken;
}
