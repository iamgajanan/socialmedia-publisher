import "server-only";

import { createHash } from "node:crypto";
import { encryptTokenWithKey, decryptTokenWithKey } from "./token-crypto-core";

function getKey() {
  const raw = process.env.SOCIAL_OAUTH_ENCRYPTION_KEY;

  if (raw) {
    const key = Buffer.from(raw, "base64");
    if (key.length !== 32) {
      throw new Error(
        "SOCIAL_OAUTH_ENCRYPTION_KEY must be a base64-encoded 32-byte key.",
      );
    }
    return key;
  }

  // Keep OAuth encryption server-only even when an existing deployment has
  // not yet provisioned the dedicated encryption key. The Supabase service
  // role key is already required by the server admin client and never reaches
  // the browser, so derive a separate 256-bit encryption key from it.
  //
  // A dedicated SOCIAL_OAUTH_ENCRYPTION_KEY remains preferred and should be
  // provisioned before rotating the Supabase service-role credential.
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;

  if (!serviceRoleKey) {
    throw new Error(
      "Missing SOCIAL_OAUTH_ENCRYPTION_KEY and Supabase server secret.",
    );
  }

  return createHash("sha256")
    .update("socialmedia-publisher/oauth-token-encryption/v1:")
    .update(serviceRoleKey)
    .digest();
}

export function encryptToken(value: string) {
  return encryptTokenWithKey(value, getKey());
}

export function decryptToken(value: string) {
  return decryptTokenWithKey(value, getKey());
}
