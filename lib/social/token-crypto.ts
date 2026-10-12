import "server-only";

import { createHash } from "node:crypto";
import { encryptTokenWithKey, decryptTokenWithKeys } from "./token-crypto-core";

function parseKey(raw: string, variable: string) {
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error(`${variable} must be a base64-encoded 32-byte key.`);
  return key;
}

function legacyKey() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
  if (!serviceRoleKey) return null;
  return createHash("sha256")
    .update("socialmedia-publisher/oauth-token-encryption/v1:")
    .update(serviceRoleKey)
    .digest();
}

function primaryKey() {
  const raw = process.env.SOCIAL_OAUTH_ENCRYPTION_KEY;
  if (raw) return parseKey(raw, "SOCIAL_OAUTH_ENCRYPTION_KEY");
  const legacy = legacyKey();
  if (!legacy) throw new Error("Missing SOCIAL_OAUTH_ENCRYPTION_KEY and Supabase server secret.");
  return legacy;
}

function decryptionKeys() {
  const keys: Buffer[] = [];
  const primary = process.env.SOCIAL_OAUTH_ENCRYPTION_KEY;
  const previous = process.env.SOCIAL_OAUTH_ENCRYPTION_KEY_PREVIOUS;
  if (primary) keys.push(parseKey(primary, "SOCIAL_OAUTH_ENCRYPTION_KEY"));
  if (previous) keys.push(parseKey(previous, "SOCIAL_OAUTH_ENCRYPTION_KEY_PREVIOUS"));
  const legacy = legacyKey();
  if (legacy) keys.push(legacy);
  if (keys.length === 0) throw new Error("Missing OAuth token encryption key configuration.");
  return keys.filter((key, index) => keys.findIndex((candidate) => candidate.equals(key)) === index);
}

export function encryptToken(value: string) {
  // New ciphertext always uses the primary dedicated key when configured.
  // The legacy service-role-derived key remains a temporary compatibility fallback.
  return encryptTokenWithKey(value, primaryKey());
}

export function decryptToken(value: string) {
  return decryptTokenWithKeys(value, decryptionKeys());
}
