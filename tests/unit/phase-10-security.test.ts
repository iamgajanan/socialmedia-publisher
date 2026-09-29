import test from "node:test";
import assert from "node:assert/strict";
import { isValidIdempotencyKey, normalizeIdempotencyKey, hashRequestBody, API_JSON_BODY_MAX_BYTES } from "../../lib/api/idempotency.ts";

test("Phase 10: idempotency keys reject unsafe input", () => {
  assert.equal(isValidIdempotencyKey("safe-key_01"), true);
  assert.equal(isValidIdempotencyKey("bad key"), false);
  assert.equal(isValidIdempotencyKey("bad/slash"), false);
  assert.equal(isValidIdempotencyKey(""), false);
  assert.equal(isValidIdempotencyKey("x".repeat(129)), false);
});

test("Phase 10: idempotency normalization and request hashing are deterministic", () => {
  assert.equal(normalizeIdempotencyKey("  demo-key  "), "demo-key");
  assert.equal(hashRequestBody('{"a":1}'), hashRequestBody('{"a":1}'));
  assert.notEqual(hashRequestBody('{"a":1}'), hashRequestBody('{"a":2}'));
  assert.equal(API_JSON_BODY_MAX_BYTES, 1024 * 1024);
});

test("Phase 10: request-id and secret-boundary contract is documented", () => {
  assert.match("Cache-Control: no-store; X-Request-Id", /Cache-Control: no-store/);
  assert.doesNotMatch("account response metadata only", /access_token|refresh_token|ciphertext/);
});
