import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export function encryptTokenWithKey(value: string, key: Buffer) {
  if (key.length !== 32) throw new Error("Encryption key must be 32 bytes.");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]).toString("base64");
}

export function decryptTokenWithKey(value: string, key: Buffer) {
  if (key.length !== 32) throw new Error("Encryption key must be 32 bytes.");
  const payload = Buffer.from(value, "base64");
  if (payload.length < 29) throw new Error("Invalid encrypted token.");
  const iv = payload.subarray(0, 12);
  const tag = payload.subarray(12, 28);
  const ciphertext = payload.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}
