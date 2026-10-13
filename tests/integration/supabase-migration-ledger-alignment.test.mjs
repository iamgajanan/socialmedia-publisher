import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const migrations = "supabase/migrations";

test("applied rate-limit and grant-hardening migrations use their live ledger versions", () => {
  const rateLimitPath = `${migrations}/20261013101003_secure_socialmedia_rate_limits.sql`;
  const grantsPath = `${migrations}/20261013105605_harden_socialmedia_table_privileges.sql`;

  assert.equal(existsSync(rateLimitPath), true);
  assert.equal(existsSync(grantsPath), true);
  assert.equal(existsSync(`${migrations}/20261013152500_secure_socialmedia_rate_limits.sql`), false);
  assert.equal(existsSync(`${migrations}/20261013153000_harden_socialmedia_table_privileges.sql`), false);

  const rateLimitMigration = readFileSync(rateLimitPath, "utf8");
  assert.match(rateLimitMigration, /socialmedia_rate_limits/i);
  assert.match(rateLimitMigration, /revoke all/i);

  const grantMigration = readFileSync(grantsPath, "utf8");
  assert.match(grantMigration, /notification_logs/i);
  assert.match(grantMigration, /alter default privileges/i);
});
