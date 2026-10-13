import test from "node:test";
import assert from "node:assert/strict";
import { normalizeXRefreshResponse } from "../../lib/publishing/providers/x-refresh.ts";

test("X refresh response preserves rotated refresh tokens", () => {
  assert.deepEqual(normalizeXRefreshResponse({
    access_token: "new-access",
    refresh_token: "new-refresh",
    expires_in: 7200,
  }), {
    accessToken: "new-access",
    refreshToken: "new-refresh",
    expiresIn: 7200,
  });
});

test("X refresh response preserves existing refresh token when provider omits rotation", () => {
  assert.deepEqual(normalizeXRefreshResponse({ access_token: "new-access" }), {
    accessToken: "new-access",
  });
});

test("X refresh response without an access token is rejected", () => {
  assert.equal(normalizeXRefreshResponse({ refresh_token: "new-refresh" }), null);
});
