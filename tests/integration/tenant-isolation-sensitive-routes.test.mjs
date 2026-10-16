import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workspaceServer = readFileSync("lib/workspace/server.ts", "utf8");
const apiAuth = readFileSync("lib/api/api-auth.ts", "utf8");
const postsRoute = readFileSync("app/api/v1/posts/route.ts", "utf8");
const apiKeyRoute = readFileSync("app/api/v1/api-keys/[id]/route.ts", "utf8");

test("server workspace context requires an active membership", () => {
  const membershipLookup = workspaceServer.slice(
    workspaceServer.indexOf('from("socialmedia_workspace_members")'),
    workspaceServer.indexOf("if (membershipError)"),
  );
  assert.match(membershipLookup, /eq\("workspace_id", profile\.workspace_id\)/);
  assert.match(membershipLookup, /eq\("profile_id", profileId\)/);
  assert.match(membershipLookup, /eq\("status", "active"\)/);
});

test("API-key authentication binds a key to an active membership in its stored workspace", () => {
  assert.match(apiAuth, /const workspaceId = String\(data\.workspace_id/);
  const membershipLookup = apiAuth.slice(
    apiAuth.indexOf('from("socialmedia_workspace_members")'),
    apiAuth.indexOf("if (membershipError)"),
  );
  assert.match(membershipLookup, /eq\("profile_id", profileId\)/);
  assert.match(membershipLookup, /eq\("workspace_id", workspaceId\)/);
  assert.match(membershipLookup, /eq\("status", "active"\)/);
});

test("post platform filters are restricted to the authenticated profile and workspace", () => {
  const platformLookup = postsRoute.slice(
    postsRoute.indexOf('from("socialmedia_post_platforms")'),
    postsRoute.indexOf("if (linksError)"),
  );
  assert.match(platformLookup, /socialmedia_posts!inner\(profile_id,workspace_id\)/);
  assert.match(platformLookup, /eq\("socialmedia_posts\.profile_id", authentication\.profileId\)/);
  assert.match(platformLookup, /eq\("socialmedia_posts\.workspace_id", authentication\.workspaceId\)/);
});

test("API key revocation cannot mutate a key outside the active workspace", () => {
  assert.match(apiKeyRoute, /\.eq\("workspace_id", workspaceContext\.workspace\.id\)/);
  assert.match(apiKeyRoute, /\.eq\("profile_id", workspaceContext\.profileId\)/);
});

const postDetailRoute = readFileSync("app/api/v1/posts/[postId]/route.ts", "utf8");
const analyticsPostsRoute = readFileSync("app/api/v1/analytics/posts/route.ts", "utf8");
const analyticsOverviewRoute = readFileSync("app/api/v1/analytics/overview/route.ts", "utf8");
const mediaRoute = readFileSync("app/api/v1/media/route.ts", "utf8");
const webhookRoute = readFileSync("app/api/v1/webhooks/[id]/route.ts", "utf8");
const webhookDeliveriesRoute = readFileSync("app/api/v1/webhooks/[id]/deliveries/route.ts", "utf8");

test("single-post detail queries constrain destinations to the active profile and workspace", () => {
  assert.match(postDetailRoute, /socialmedia_posts!inner\(profile_id,workspace_id\)/);
  assert.match(postDetailRoute, /eq\("socialmedia_posts\.profile_id", profileId\)/);
  assert.match(postDetailRoute, /eq\("socialmedia_posts\.workspace_id", workspaceId\)/);
  assert.match(postDetailRoute, /filter\(\(link\) => !link\.social_account_id \|\| accountsById\.has\(link\.social_account_id\)\)/);
});

test("post list and analytics endpoints allowlist destination accounts by tenant", () => {
  assert.match(postsRoute, /filter\(\(link\) => !link\.social_account_id \|\| accountsById\.has\(link\.social_account_id\)\)/);
  assert.match(analyticsPostsRoute, /socialmedia_posts!inner\(profile_id,workspace_id\)/);
  assert.match(analyticsPostsRoute, /eq\("workspace_id", authentication\.workspaceId\)/);
  assert.match(analyticsPostsRoute, /ownedAccountIds\.has\(link\.social_account_id\)/);
  assert.match(analyticsOverviewRoute, /eq\("socialmedia_posts\.workspace_id",authentication\.workspaceId\)/);
  assert.match(analyticsOverviewRoute, /ownedAccountIds\.has\(link\.social_account_id\)/);
});

test("media and webhook APIs keep tenant resources bound to the authenticated profile", () => {
  assert.match(mediaRoute, /authentication\.profileId.*randomUUID/);
  assert.match(webhookRoute, /\.eq\("profile_id", user\.id\)/);
  assert.match(webhookDeliveriesRoute, /\.eq\("profile_id", user\.id\)/);
});
