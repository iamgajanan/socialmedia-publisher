import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

const migrationPath = join(
  process.cwd(),
  "supabase/migrations/20261013101003_secure_socialmedia_rate_limits.sql",
);

test("legacy rate-limit counters enable RLS and remain server-only", async () => {
  const sql = await readFile(migrationPath, "utf8");

  assert.match(
    sql,
    /alter table public\.socialmedia_rate_limits enable row level security;/i,
  );
  assert.match(
    sql,
    /revoke all on table public\.socialmedia_rate_limits from public, anon, authenticated;/i,
  );
  assert.match(
    sql,
    /grant all on table public\.socialmedia_rate_limits to service_role;/i,
  );
  assert.match(
    sql,
    /revoke all on function public\.socialmedia_consume_rate_limit\(text, integer, integer\)\s+from public, anon, authenticated;/i,
  );
  assert.match(
    sql,
    /grant execute on function public\.socialmedia_consume_rate_limit\(text, integer, integer\)\s+to service_role;/i,
  );
  assert.doesNotMatch(sql, /create policy/i);
});
