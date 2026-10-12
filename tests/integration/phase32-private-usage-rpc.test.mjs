import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("workspace usage RPC returns bigint for every declared aggregate column", async () => {
  const sql = await readFile("supabase/migrations/20261012180035_phase32_private_usage_rpc_bigint_fix.sql", "utf8");
  assert.match(sql, /coalesce\(\(select u\.api_requests[\s\S]*?\), 0\)::bigint as api_requests/i);
});
test("workspace aggregate usage RPC is private, membership-checked, and not exposed publicly", async () => {
  const sql = await readFile("supabase/migrations/20261012175632_phase32_private_usage_rpc.sql", "utf8");
  const verifier = await readFile("supabase/verification/phase32_schema_check.sql", "utf8");

  assert.match(sql, /create or replace function private\.socialmedia_workspace_usage/i);
  assert.match(sql, /security definer/i);
  assert.match(sql, /set search_path = ''/i);
  assert.match(sql, /wm\.workspace_id = target_workspace_id/);
  assert.match(sql, /wm\.profile_id = \(select auth\.uid\(\)\)/);
  assert.match(sql, /errcode = '42501'/);
  assert.match(sql, /revoke all on function public\.socialmedia_workspace_usage\(uuid, date\) from public, anon, authenticated/i);
  assert.match(sql, /drop function if exists public\.socialmedia_workspace_usage\(uuid, date\)/i);
  assert.match(sql, /grant execute on function private\.socialmedia_workspace_usage\(uuid, date\) to authenticated/i);
  assert.match(verifier, /to_regprocedure\('private\.socialmedia_workspace_usage\(uuid,date\)'\)/i);
  assert.match(verifier, /must not remain in the exposed public schema/i);
});
