import test from "node:test";
import assert from "node:assert/strict";
import { encryptTokenWithKey, decryptTokenWithKey } from "../../lib/social/token-crypto-core.ts";
const key = Buffer.alloc(32, 7);

test("encrypts and decrypts OAuth tokens", () => {
  const plaintext = "provider-secret-token";
  const encrypted = encryptTokenWithKey(plaintext, key);
  assert.notEqual(encrypted, plaintext);
  assert.equal(decryptTokenWithKey(encrypted, key), plaintext);
});

test("tampering with ciphertext fails authentication", () => {
  const encrypted = encryptTokenWithKey("secret", key);
  const payload = Buffer.from(encrypted, "base64");
  payload[payload.length - 1] ^= 1;
  assert.throws(() => decryptTokenWithKey(payload.toString("base64"), key));
});
