import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const cron = readFileSync(new URL("../../app/api/cron/analytics/route.ts", import.meta.url), "utf8");
const rotation = readFileSync(new URL("../../lib/social/rotate-oauth-tokens.ts", import.meta.url), "utf8");

test("OAuth rotation runs only through the existing protected analytics cron when enabled", () => {
  assert.match(cron, /function authorized\(request: Request\)/);
  assert.match(cron, /runOAuthRotationAcceptance\(admin\)/);
  assert.match(rotation, /OAUTH_TOKEN_ROTATION_ENABLED !== "true"/);
  assert.match(rotation, /OAUTH_TOKEN_ROTATION_STARTED_AT/);
});

test("rotation acceptance never returns or logs token values", () => {
  assert.match(rotation, /oauth_key_rotation_acceptance/);
  assert.doesNotMatch(rotation, /console\.(log|info|error)\([^\n]*(access_token_ciphertext|refresh_token_ciphertext)/);
});
