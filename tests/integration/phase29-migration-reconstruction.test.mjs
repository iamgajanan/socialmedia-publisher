import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Phase 29 analytics migration matches the schema recorded in Supabase", async () => {
  const sql = await readFile("supabase/migrations/20261006183954_phase_29_analytics_reporting.sql", "utf8");
  assert.match(sql, /create table if not exists public\.socialmedia_post_analytics/i);
  assert.match(sql, /create table if not exists public\.socialmedia_account_analytics/i);
  assert.match(sql, /unique \(post_platform_id, period_start, period_end, source\)/i);
  assert.match(sql, /unique \(social_account_id, period_start, period_end, source\)/i);
  assert.match(sql, /socialmedia_post_analytics_select_own/);
  assert.match(sql, /socialmedia_account_analytics_select_own/);
  assert.match(sql, /enable row level security/);
});
