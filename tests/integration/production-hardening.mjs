import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const nextConfig = readFileSync("next.config.ts", "utf8");
const envExample = readFileSync(".env.example", "utf8");

test("production security headers are configured", () => {
  for (const header of ["X-Content-Type-Options", "X-Frame-Options", "Referrer-Policy", "Permissions-Policy", "Content-Security-Policy"]) assert.match(nextConfig, new RegExp(header));
  assert.match(nextConfig, /poweredByHeader:\s*false/);
});

test("scheduled worker routes are configured for external scheduling", () => {
  assert.equal(existsSync("vercel.json"), false, "Vercel Hobby must not own the minute-level cron schedule");
  const publishRoute = readFileSync("app/api/cron/publish/route.ts", "utf8");
  const notificationRoute = readFileSync("app/api/cron/notifications/route.ts", "utf8");
  assert.match(publishRoute, /CRON_SECRET/);
  assert.match(notificationRoute, /CRON_SECRET/);
  assert.match(publishRoute, /authorization/i);
  assert.match(notificationRoute, /authorization/i);
});

test("production environment contract documents required secrets", () => {
  for (const key of ["SITE_URL","SUPABASE_URL","SUPABASE_PUBLISHABLE_KEY","SUPABASE_SERVICE_ROLE_KEY","SOCIAL_OAUTH_ENCRYPTION_KEY","CRON_SECRET","RESEND_API_KEY","RESEND_FROM_EMAIL"]) {
    assert.ok(envExample.includes(key + "="), key);
  }
});
