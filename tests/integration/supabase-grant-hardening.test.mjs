import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("grant hardening scopes revokes to SocialMedia tables and server-managed notification logs", () => {
  const migration = readFileSync(
    "supabase/migrations/20261013105605_harden_socialmedia_table_privileges.sql",
    "utf8",
  );

  assert.match(migration, /n\.nspname = 'public'/);
  assert.match(migration, /left\(c\.relname, 12\) = 'socialmedia_'/);
  assert.match(migration, /c\.relname = 'notification_logs'/);
  assert.match(migration, /revoke all privileges on table %I\.%I from public, anon, authenticated/i);
  assert.match(migration, /revoke all privileges on sequence %I\.%I from public, anon, authenticated/i);
  assert.match(migration, /revoke execute on function %I\.%I\(%s\) from public, anon, authenticated/i);
});

test("grant hardening restores only policy-aligned browser table operations", () => {
  const migration = readFileSync(
    "supabase/migrations/20261013105605_harden_socialmedia_table_privileges.sql",
    "utf8",
  );

  assert.match(migration, /grant select, insert, update, delete on table[\s\S]*public\.socialmedia_posts[\s\S]*to authenticated/i);
  assert.match(migration, /grant select, update on table[\s\S]*public\.socialmedia_workspace_members[\s\S]*to authenticated/i);
  assert.match(migration, /grant select on table public\.socialmedia_workspace_usage_monthly to authenticated/i);
  assert.match(migration, /alter default privileges for role postgres in schema public[\s\S]*revoke all on tables from public, anon, authenticated/i);
  assert.match(migration, /revoke all on sequences from public, anon, authenticated/i);
});
