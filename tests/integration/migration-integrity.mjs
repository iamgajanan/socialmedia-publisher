import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";

const files = readdirSync("supabase/migrations").filter((name) => name.endsWith(".sql")).sort();
assert.ok(files.length >= 15, "expected the project's migration history to be present");

test("migration versions are unique and ordered", () => {
  const versions = files.map((name) => name.match(/^(\d+)_/)?.[1]).filter(Boolean);
  assert.equal(new Set(versions).size, versions.length);
  assert.deepEqual(versions, [...versions].sort());
});

test("critical security and reliability migrations exist", () => {
  const required = [
    "202609270003_social_accounts_oauth.sql",
    "202609270005_social_media_storage.sql",
    "202609270007_publishing_retry_system.sql",
    "202609270008_publishing_idempotency.sql",
    "202609270009_publishing_state_machine.sql",
    "202609270011_notification_logs.sql",
    "202609270012_security_hardening.sql",
    "202609290015_socialmedia_oauth_health.sql",
  ];
  for (const file of required) {
    assert.ok(files.includes(file), file);
    assert.ok(readFileSync(`supabase/migrations/${file}`, "utf8").length > 100, file);
  }
});

test("Phase 1 OAuth health migration uses the socialmedia naming convention and protects health records", () => {
  const migration = readFileSync("supabase/migrations/202609290015_socialmedia_oauth_health.sql", "utf8");
  assert.match(migration, /create table if not exists public\.socialmedia_oauth_health_checks/);
  assert.match(migration, /alter table public\.socialmedia_oauth_health_checks enable row level security/);
  assert.match(migration, /revoke insert, update, delete on public\.socialmedia_oauth_health_checks from anon, authenticated/);
  assert.match(migration, /grant select, insert, update, delete on public\.socialmedia_oauth_health_checks to service_role/);
});
