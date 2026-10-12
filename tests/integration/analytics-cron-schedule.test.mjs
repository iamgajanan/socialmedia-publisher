import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("daily Vercel cron targets the authenticated analytics sync route", async () => {
  const config = JSON.parse(await readFile("vercel.json", "utf8"));
  const route = await readFile("app/api/cron/analytics/route.ts", "utf8");
  assert.ok(config.crons.some((cron) => cron.path === "/api/cron/analytics" && cron.schedule === "0 3 * * *"));
  assert.match(route, /export async function GET\(request: Request\) \{ return POST\(request\); \}/);
  assert.match(route, /CRON_SECRET/);
  assert.match(route, /socialmedia_analytics_sync_runs/);
});
