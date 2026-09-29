import test from "node:test";
import assert from "node:assert/strict";
import {
  buildFacebookHealthRequest,
  classifyFacebookHealth,
} from "../../lib/social/oauth-health.ts";

test("Facebook health request uses the persisted Page ID and never puts the token in the URL", () => {
  const request = buildFacebookHealthRequest("v21.0", "123456789");
  assert.equal(
    request.toString(),
    "https://graph.facebook.com/v21.0/123456789?fields=id%2Cname",
  );
  assert.equal(request.searchParams.has("access_token"), false);
});

test("successful Facebook health checks are healthy when the token is not near expiry", () => {
  const now = Date.parse("2026-09-29T00:00:00.000Z");
  const result = classifyFacebookHealth(
    200,
    "2026-10-01T00:00:00.000Z",
    now,
  );
  assert.equal(result.status, "expiring");
});

test("successful Facebook health checks remain healthy without an expiry timestamp", () => {
  const result = classifyFacebookHealth(200, null);
  assert.equal(result.status, "healthy");
});

test("Facebook authorization failures are invalid", () => {
  const result = classifyFacebookHealth(403, null, Date.now(), "190", "Invalid OAuth access token.");
  assert.equal(result.status, "invalid");
  assert.equal(result.errorCode, "190");
});

test("unexpected provider failures are errors", () => {
  const result = classifyFacebookHealth(500, null, Date.now(), "1", "Temporary failure");
  assert.equal(result.status, "error");
});
