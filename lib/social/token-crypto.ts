import "server-only";

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

function getKey() {
  const raw = process.env.SOCIAL_OAUTH_ENCRYPTION_KEY;
  if (!raw) throw new Error("Missing SOCIAL_OAUTH_ENCRYPTION_KEY.");
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("SOCIAL_OAUTH_ENCRYPTION_KEY must be a base64-encoded 32-byte key.");
  }
  return key;
}

export function encryptToken(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]).toString("base64");
}

export function decryptToken(value: string) {
  const payload = Buffer.from(value, "base64");
  const iv = payload.subarray(0, 12);
  const tag = payload.subarray(12, 28);
  const ciphertext = payload.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}
