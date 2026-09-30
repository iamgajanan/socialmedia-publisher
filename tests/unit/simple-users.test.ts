import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("dashboard uses simple Users navigation", () => {
  const source = fs.readFileSync("components/dashboard/dashboard-shell.tsx", "utf8");
  assert.match(source, /label: "Users"/);
  assert.match(source, /href: "\/users"/);
  assert.doesNotMatch(source, /Team & access/);
});

test("simple user migration defines user and account limits", () => {
  const sql = fs.readFileSync("supabase/migrations/202609300100_phase13_simple_users.sql", "utf8");
  assert.match(sql, /create table if not exists public\.socialmedia_users/);
  assert.match(sql, /max_users/);
  assert.match(sql, /SOCIAL_ACCOUNT_LIMIT_REACHED/);
  assert.match(sql, /USER_LIMIT_REACHED/);
});
