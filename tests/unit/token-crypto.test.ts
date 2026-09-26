import test from "node:test";
import assert from "node:assert/strict";
process.env.SOCIAL_OAUTH_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
const { encryptToken, decryptToken } = await import("../../lib/social/token-crypto.ts");

test("encrypts and decrypts OAuth tokens", () => {
  const plaintext = "provider-secret-token";
  const encrypted = encryptToken(plaintext);
  assert.notEqual(encrypted, plaintext);
  assert.equal(decryptToken(encrypted), plaintext);
});

test("tampering with ciphertext fails authentication", () => {
  const encrypted = encryptToken("secret");
  const payload = Buffer.from(encrypted, "base64");
  payload[payload.length - 1] ^= 1;
  assert.throws(() => decryptToken(payload.toString("base64")));
});
