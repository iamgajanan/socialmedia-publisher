import test from "node:test";
import assert from "node:assert/strict";

import { generateApiKey, hashApiKey, isApiKey, normalizeApiKey } from "../../lib/api/api-key-core.ts";

test("generates a prefixed API key and stores only its hash metadata", () => {
  const generated = generateApiKey();

  assert.match(generated.token, /^omi_live_[A-Za-z0-9_-]+$/);
  assert.equal(generated.tokenHash, hashApiKey(generated.token));
  assert.equal(generated.tokenPrefix, generated.token.slice(0, "omi_live_".length + 8));
  assert.notEqual(generated.tokenHash, generated.token);
});

test("generated API keys are unique", () => {
  assert.notEqual(generateApiKey().tokenHash, generateApiKey().tokenHash);
});

test("API key validation and normalization are deterministic", () => {
  const generated = generateApiKey();
  assert.equal(normalizeApiKey(`  ${generated.token}  `), generated.token);
  assert.equal(isApiKey(generated.token), true);
  assert.equal(isApiKey("not-an-omnisocial-key"), false);
  assert.equal(isApiKey("omi_live_short"), false);
});
