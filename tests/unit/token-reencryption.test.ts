import test from "node:test";
import assert from "node:assert/strict";
import { reencryptOAuthTokenPair } from "../../lib/social/token-reencryption-core.ts";

test("reencrypts both access and refresh tokens without changing plaintext", () => {
  const decrypted: string[] = [];
  const encrypted: string[] = [];
  const result = reencryptOAuthTokenPair({
    access_token_ciphertext: "legacy-access",
    refresh_token_ciphertext: "legacy-refresh",
  }, {
    decrypt(value) { decrypted.push(value); return `plain:${value}`; },
    encrypt(value) { encrypted.push(value); return `primary:${value}`; },
  });
  assert.deepEqual(decrypted, ["legacy-access", "legacy-refresh"]);
  assert.deepEqual(encrypted, ["plain:legacy-access", "plain:legacy-refresh"]);
  assert.deepEqual(result, {
    access_token_ciphertext: "primary:plain:legacy-access",
    refresh_token_ciphertext: "primary:plain:legacy-refresh",
  });
});

test("reencryption leaves absent refresh tokens absent", () => {
  assert.deepEqual(reencryptOAuthTokenPair({
    access_token_ciphertext: "legacy-access",
    refresh_token_ciphertext: null,
  }, {
    decrypt(value) { return value; },
    encrypt(value) { return `primary:${value}`; },
  }), { access_token_ciphertext: "primary:legacy-access" });
});
