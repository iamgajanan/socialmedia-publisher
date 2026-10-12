import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync("supabase/migrations/20261012175048_phase32_multitenant_branding_usage.sql", "utf8");
const apiAuth = readFileSync("lib/api/api-auth.ts", "utf8");
const apiKeys = readFileSync("app/api/v1/api-keys/route.ts", "utf8");
const shell = readFileSync("components/dashboard/dashboard-shell.tsx", "utf8");
const workspaceServer = readFileSync("lib/workspace/server.ts", "utf8");

test("Phase 32 adds workspace white-label identity fields", () => {
  assert.match(migration, /add column if not exists slug text/);
  assert.match(migration, /add column if not exists logo_url text/);
  assert.match(migration, /add column if not exists primary_color text/);
  assert.match(migration, /add column if not exists accent_color text/);
  assert.match(migration, /add column if not exists custom_domain text/);
  assert.match(migration, /socialmedia_workspaces_slug_uidx/);
});

test("Phase 32 backfills tenant ownership for AI, MCP, and API credentials", () => {
  for (const table of ["socialmedia_ai_generations", "socialmedia_ai_content_variants", "socialmedia_mcp_audit_logs", "socialmedia_api_keys"]) {
    assert.match(migration, new RegExp(`alter table public\\.${table}[\\s\\S]*?workspace_id`));
  }
  assert.match(apiAuth, /workspace_id/);
  assert.match(apiKeys, /workspace_id: context\.workspace\.id/);
});

test("workspace context denies inactive members before exposing tenant resources", () => {
  assert.match(workspaceServer, /from\("socialmedia_workspace_members"\)[\s\S]*?eq\("workspace_id", profile\.workspace_id\)[\s\S]*?eq\("profile_id", profileId\)[\s\S]*?eq\("status", "active"\)/);
  assert.match(workspaceServer, /if \(!membership\) throw new Error\("You are not an active member of this workspace\."\)/);
});

test("Phase 32 records workspace API usage and exposes a workspace switcher", () => {
  assert.match(migration, /socialmedia_record_api_request/);
  assert.match(apiAuth, /socialmedia_record_api_request/);
  assert.match(shell, /WorkspaceSwitcher/);
  assert.match(shell, /settings\/branding/);
  assert.match(shell, /\/usage/);
});
