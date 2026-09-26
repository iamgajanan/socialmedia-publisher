import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const nextConfig = readFileSync("next.config.ts", "utf8");
const cronConfig = JSON.parse(readFileSync("vercel.json", "utf8"));
const envExample = readFileSync(".env.example", "utf8");

test("production security headers are configured", () => {
  for (const header of ["X-Content-Type-Options", "X-Frame-Options", "Referrer-Policy", "Permissions-Policy", "Content-Security-Policy"]) assert.match(nextConfig, new RegExp(header));
  assert.match(nextConfig, /poweredByHeader:\s*false/);
});

test("both protected cron jobs are scheduled", () => {
  const paths = cronConfig.crons.map((cron) => cron.path);
  assert.deepEqual(paths.sort(), ["/api/cron/notifications", "/api/cron/publish"].sort());
  assert.equal(cronConfig.crons.every((cron) => cron.schedule === "* * * * *"), true);
});

test("production environment contract documents required secrets", () => {
  for (const key of ["SITE_URL","SUPABASE_URL","SUPABASE_PUBLISHABLE_KEY","SUPABASE_SERVICE_ROLE_KEY","SOCIAL_OAUTH_ENCRYPTION_KEY","CRON_SECRET","RESEND_API_KEY","RESEND_FROM_EMAIL"]) {
    assert.ok(envExample.includes(key + "="), key);
  }
});
