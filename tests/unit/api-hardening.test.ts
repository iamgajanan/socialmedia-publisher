import test from "node:test";
import assert from "node:assert/strict";

import {
  API_IDEMPOTENCY_KEY_MAX_LENGTH,
  API_JSON_BODY_MAX_BYTES,
  hashRequestBody,
  isValidIdempotencyKey,
} from "../../lib/api/idempotency.ts";

test("accepts safe idempotency keys", () => {
  assert.equal(isValidIdempotencyKey("publish-2026-09-29_01"), true);
  assert.equal(isValidIdempotencyKey("a:b.c~d-e"), true);
});

test("rejects malformed idempotency keys", () => {
  assert.equal(isValidIdempotencyKey(""), false);
  assert.equal(isValidIdempotencyKey("contains spaces"), false);
  assert.equal(isValidIdempotencyKey("x".repeat(API_IDEMPOTENCY_KEY_MAX_LENGTH + 1)), false);
});

test("request body hashing is stable", () => {
  assert.equal(hashRequestBody('{"text":"hello"}'), hashRequestBody('{"text":"hello"}'));
  assert.notEqual(hashRequestBody('{"text":"hello"}'), hashRequestBody('{"text":"different"}'));
});

test("JSON API body limit is 1 MB", () => {
  assert.equal(API_JSON_BODY_MAX_BYTES, 1024 * 1024);
});
