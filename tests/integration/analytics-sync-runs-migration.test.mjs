import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("analytics sync run migration matches server write contract and stays service-only", async () => {
  const sql = await readFile("supabase/migrations/20261012175109_phase29_analytics_sync_runs_reconciliation.sql", "utf8");
  for (const column of ["profile_id", "status", "started_at", "finished_at", "accounts_scanned", "accounts_succeeded", "accounts_failed", "posts_scanned", "metrics_written", "error_count", "errors"]) {
    assert.match(sql, new RegExp("\\b" + column + "\\b"));
  }
  assert.match(sql, /create table if not exists public\.socialmedia_analytics_sync_runs/i);
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /revoke all on table public\.socialmedia_analytics_sync_runs from anon, authenticated/i);
  assert.match(sql, /grant all on table public\.socialmedia_analytics_sync_runs to service_role/i);
  assert.match(sql, /profile_id, started_at desc/i);
});
