import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

const migrationPath = join(
  process.cwd(),
  "supabase/migrations/20261012175048_phase32_multitenant_branding_usage.sql",
);

test("Phase 32 SQL function bodies use valid dollar quoting", async () => {
  const sql = await readFile(migrationPath, "utf8");

  assert.equal((sql.match(/\bas \$\$/g) ?? []).length, 1);
  assert.equal((sql.match(/\$\$;/g) ?? []).length, 1);
  assert.equal((sql.match(/\$workspace_ids\$/g) ?? []).length, 2);
  assert.equal((sql.match(/\$workspace_usage\$/g) ?? []).length, 2);
  assert.doesNotMatch(sql, /\bas \$(?!\$|workspace_ids\$|workspace_usage\$)/);
  assert.doesNotMatch(sql, /(^|\n)\$(?!\$|workspace_ids\$|workspace_usage\$);(?=\n)/m);
});

test("Phase 32 API usage RPC is only executable by the service role", async () => {
  const sql = await readFile(migrationPath, "utf8");

  assert.match(
    sql,
    /revoke all on function public\.socialmedia_record_api_request\(uuid, date\) from public, anon, authenticated;/i,
  );
  assert.match(
    sql,
    /grant execute on function public\.socialmedia_record_api_request\(uuid, date\) to service_role;/i,
  );
  assert.match(
    sql,
    /create or replace function public\.socialmedia_record_api_request[\s\S]*?security definer[\s\S]*?set search_path = ''[\s\S]*?as \$\$/,
  );
});

test("Phase 32 reconciles the workspace member timestamp used by the app", async () => {
  const sql = await readFile(migrationPath, "utf8");

  assert.match(
    sql,
    /alter table public\.socialmedia_workspace_members\s+add column if not exists created_at timestamptz not null default now\(\);/i,
  );
});

test("Phase 32 backfills API-key workspace ownership before enforcing it", async () => {
  const sql = await readFile(migrationPath, "utf8");
  const backfill = sql.indexOf("update public.socialmedia_api_keys k");
  const notNull = sql.indexOf(
    "alter table public.socialmedia_api_keys alter column workspace_id set not null;",
  );

  assert.notEqual(backfill, -1, "API-key workspace backfill must exist");
  assert.notEqual(notNull, -1, "API-key workspace ownership must be required");
  assert.ok(backfill < notNull, "Backfill must precede NOT NULL enforcement");
  assert.match(
    sql,
    /create index if not exists socialmedia_api_keys_workspace_created_idx/i,
  );
});

test("Phase 32 usage reports zero API requests when no monthly usage row exists", async () => {
  const sql = await readFile(migrationPath, "utf8");

  assert.match(
    sql,
    /coalesce\(\(select u\.api_requests from public\.socialmedia_workspace_usage_monthly u[\s\S]*?and u\.period_start = target_period_start\), 0\) as api_requests;/i,
  );
});
