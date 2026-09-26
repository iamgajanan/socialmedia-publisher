import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";

const files = readdirSync("supabase/migrations").filter((name) => name.endsWith(".sql")).sort();
assert.ok(files.length >= 11, "expected the project's migration history to be present");

test("migration versions are unique and ordered", () => {
  const versions = files.map((name) => name.match(/^(\d+)_/)?.[1]).filter(Boolean);
  assert.equal(new Set(versions).size, versions.length);
  assert.deepEqual(versions, [...versions].sort());
});

test("critical security and reliability migrations exist", () => {
  const required = ["202609270003_social_accounts_oauth.sql","202609270005_social_media_storage.sql","202609270007_publishing_retry_system.sql","202609270008_publishing_idempotency.sql","202609270009_publishing_state_machine.sql","202609270011_notification_logs.sql"];
  for (const file of required) {
    assert.ok(files.includes(file), file);
    assert.ok(readFileSync(`supabase/migrations/${file}`, "utf8").length > 100, file);
  }
});
