import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("analytics sync has a protected daily production schedule", () => {
  const config = JSON.parse(readFileSync("vercel.json", "utf8"));
  assert.deepEqual(config.crons, [{ path: "/api/cron/analytics", schedule: "10 12 * * *" }]);

  const route = readFileSync("app/api/cron/analytics/route.ts", "utf8");
  assert.match(route, /export async function GET\(request: Request\) \{ return POST\(request\); \}/);
  assert.match(route, /CRON_SECRET/);
  assert.match(route, /timingSafeEqual/);
  assert.match(route, /socialmedia_analytics_sync_runs/);
  assert.match(route, /syncAnalyticsForProfile/);
});
