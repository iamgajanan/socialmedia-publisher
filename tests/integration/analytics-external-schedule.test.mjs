import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("analytics sync has a protected daily production schedule", () => {
  const config = JSON.parse(readFileSync("vercel.json", "utf8"));
  assert.deepEqual(config.crons, [{ path: "/api/cron/analytics", schedule: "15 11 * * *" }]);

  const route = readFileSync("app/api/cron/analytics/route.ts", "utf8");
  assert.match(route, /export async function GET\(request: Request\) \{ return POST\(request\); \}/);
  assert.match(route, /CRON_SECRET/);
  assert.match(route, /timingSafeEqual/);
  assert.match(route, /socialmedia_analytics_sync_runs/);
  assert.match(route, /syncAnalyticsForProfile/);
});

test("analytics cron reports partial provider failures instead of returning a false healthy response", () => {
  const route = readFileSync("app/api/cron/analytics/route.ts", "utf8");
  assert.match(route, /const failedProfiles = results\.filter\(\(item\) => Boolean\(item\.error\) \|\| item\.failedAccounts > 0\)\.length/);
  assert.match(route, /\{ status: ok \? 200 : 502 \}/);
  assert.match(route, /failedProfiles, results/);
});

test("X analytics is explicitly excluded from the current release scope", () => {
  const capabilities = readFileSync("lib/analytics/capabilities.ts", "utf8");
  assert.match(capabilities, /platform === "x"/);
  assert.match(capabilities, /x_analytics_not_in_release_scope/);
});
