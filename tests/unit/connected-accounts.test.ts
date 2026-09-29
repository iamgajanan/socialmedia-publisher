import test from "node:test";
import assert from "node:assert/strict";
import { normalizeConnectedAccount, parsePlatformFilter } from "../../lib/api/connected-accounts-core.ts";

test("platform filters are normalized, deduplicated and validated", () => {
  assert.deepEqual(parsePlatformFilter(" Facebook,instagram,facebook "), { platforms: ["facebook","instagram"] });
  assert.deepEqual(parsePlatformFilter(null), {});
  assert.deepEqual(parsePlatformFilter(""), {});
  assert.equal(parsePlatformFilter("facebook,unknown").error, "Unsupported platform: unknown.");
});

test("connected account normalization exposes non-secret account metadata only", () => {
  const account = normalizeConnectedAccount({
    id:"account-1", platform:"facebook", account_name:"My Page", external_account_id:"page-123",
    username:null, avatar_url:null, status:"connected", provider_account_url:"https://facebook.com/page-123",
  });
  assert.deepEqual(account, {
    id:"account-1", platform:"facebook", accountName:"My Page", externalAccountId:"page-123",
    username:null, avatarUrl:null, status:"connected", providerAccountUrl:"https://facebook.com/page-123",
  });
  assert.equal("accessToken" in (account ?? {}), false);
  assert.equal("refreshToken" in (account ?? {}), false);
  assert.equal("metadata" in (account ?? {}), false);
});

test("invalid provider rows are not exposed", () => {
  assert.equal(normalizeConnectedAccount({
    id:"account-1", platform:"unknown", account_name:"Unknown", external_account_id:"external-1",
    username:null, avatar_url:null, status:"connected", provider_account_url:null,
  }), null);
  assert.equal(normalizeConnectedAccount({
    id:"account-2", platform:"facebook", account_name:"Bad", external_account_id:"external-2",
    username:null, avatar_url:null, status:"unexpected", provider_account_url:null,
  }), null);
});
