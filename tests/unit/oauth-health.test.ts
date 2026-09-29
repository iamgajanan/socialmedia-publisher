import test from "node:test";
import assert from "node:assert/strict";
import { buildFacebookHealthRequest, classifyFacebookHealth } from "../../lib/social/oauth-health-core.ts";

test("Facebook health request uses persisted Page ID and never puts token in URL", () => {
  const request = buildFacebookHealthRequest("v21.0", "123456789");
  assert.equal(request.toString(), "https://graph.facebook.com/v21.0/123456789?fields=id%2Cname");
  assert.equal(request.searchParams.has("access_token"), false);
});

test("successful checks become expiring inside seven-day window", () => {
  const now = Date.parse("2026-09-29T00:00:00.000Z");
  assert.equal(classifyFacebookHealth(200, "2026-10-01T00:00:00.000Z", now).status, "expiring");
});

test("successful checks remain healthy without expiry", () => {
  assert.equal(classifyFacebookHealth(200, null).status, "healthy");
});

test("authorization failures are invalid", () => {
  const result = classifyFacebookHealth(403, null, Date.now(), "190", "Invalid OAuth access token.");
  assert.equal(result.status, "invalid");
  assert.equal(result.errorCode, "190");
});

test("unexpected provider failures are errors", () => {
  assert.equal(classifyFacebookHealth(500, null, Date.now(), "1", "Temporary failure").status, "error");
});
