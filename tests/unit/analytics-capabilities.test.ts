import test from "node:test";
import assert from "node:assert/strict";
import { getAnalyticsCapabilityWarning } from "../../lib/analytics/capabilities.ts";

test("non-LinkedIn analytics is unaffected by LinkedIn-specific scopes", () => {
  assert.equal(getAnalyticsCapabilityWarning({ platform: "instagram", metadata: null, scopes: [] }), null);
});

test("personal LinkedIn analytics is skipped when the provider has not granted its analytics scope", () => {
  assert.equal(getAnalyticsCapabilityWarning({
    platform: "linkedin",
    metadata: {},
    scopes: ["email", "openid", "profile", "w_member_social"],
  }), "linkedin_member_analytics_scope_missing");
});

test("personal LinkedIn analytics is enabled only with the granted member analytics scope", () => {
  assert.equal(getAnalyticsCapabilityWarning({
    platform: "linkedin",
    metadata: {},
    scopes: ["w_member_social", "r_member_postAnalytics"],
  }), null);
});

test("organization analytics requires an organization analytics scope", () => {
  assert.equal(getAnalyticsCapabilityWarning({
    platform: "linkedin",
    metadata: { linkedin_organization_id: "123" },
    scopes: ["w_member_social"],
  }), "linkedin_organization_analytics_scope_missing");
});
