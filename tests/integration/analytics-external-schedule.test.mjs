import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

test("analytics sync is protected for external scheduling and does not add Vercel cron", () => {
  assert.equal(existsSync("vercel.json"), false);
  const route = readFileSync("app/api/cron/analytics/route.ts", "utf8");
  assert.match(route, /export async function GET\(request: Request\) \{ return POST\(request\); \}/);
  assert.match(route, /CRON_SECRET/);
  assert.match(route, /timingSafeEqual/);
  assert.match(route, /socialmedia_analytics_sync_runs/);
});
