import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();
const preflightPath = join(root, "supabase/verification/phase32_preflight.sql");
const verificationPath = join(root, "supabase/verification/phase32_schema_check.sql");
const migrationPath = join(root, "supabase/migrations/202610080002_phase32_multitenant_branding_usage.sql");
const runbookPath = join(root, "docs/phase32-production-reconciliation.md");

test("Phase 32 preflight is read-only and checks prerequisite schema", async () => {
  const sql = await readFile(preflightPath, "utf8");

  assert.match(sql, /Phase 32 production migration preflight \(READ ONLY\)/i);
  assert.match(sql, /information_schema\.columns/i);
  assert.match(sql, /to_regclass/i);
  assert.match(sql, /socialmedia_profiles/);
  assert.match(sql, /socialmedia_workspace_members/);
  assert.match(sql, /socialmedia_api_keys/);
  assert.match(sql, /socialmedia_ai_generations/);
  assert.match(sql, /socialmedia_ai_content_variants/);
  assert.match(sql, /socialmedia_mcp_audit_logs/);
  assert.match(sql, /socialmedia_social_accounts/);
  assert.match(sql, /socialmedia_posts/);
  assert.match(sql, /raise exception/i);
  assert.doesNotMatch(sql, /\b(insert\s+into|update\s+public\.|delete\s+from|alter\s+table|create\s+table|drop\s+table)\b/i);
  assert.equal(sql.split("$phase32_preflight$").length - 1, 2);
  assert.equal((sql.split("$query$").length - 1) % 2, 0);
  assert.equal(sql.split("preflight_result").length - 1, 1);
});

test("Phase 32 preflight catches profile/workspace and membership inconsistencies before migration", async () => {
  const sql = await readFile(preflightPath, "utf8");

  assert.match(sql, /p\.workspace_id is null or w\.id is null/i);
  assert.match(sql, /API key\(s\) cannot be backfilled/i);
  assert.match(sql, /AI generation\(s\) cannot be backfilled/i);
  assert.match(sql, /AI variant\(s\) cannot be assigned/i);
  assert.match(sql, /MCP audit log\(s\) cannot be assigned/i);
  assert.match(sql, /lack active membership/i);
  assert.match(sql, /duplicate workspace slug/i);
  assert.match(sql, /duplicate custom-domain/i);
  assert.match(sql, /invalid primary colors/i);
  assert.match(sql, /workspace IDs that do not reference a workspace/i);
  assert.match(sql, /different workspace than their parent generation/i);
});

test("Phase 32 schema verifier remains read-only and covers critical RPC grants", async () => {
  const sql = await readFile(verificationPath, "utf8");

  assert.match(sql, /socialmedia_workspace_usage\(uuid,date\)/);
  assert.match(sql, /socialmedia_record_api_request\(uuid,date\)/);
  assert.ok(sql.includes("has_function_privilege('service_role', record_rpc::oid, 'EXECUTE')"));
  assert.match(sql, /has_function_privilege\('service_role'/i);
  assert.match(sql, /relrowsecurity/i);
  assert.doesNotMatch(sql, /\b(insert\s+into|update\s+public\.|delete\s+from|alter\s+table|create\s+table|drop\s+table)\b/i);
});

test("Phase 32 schema migration backfills tenant ownership before enforcing NOT NULL", async () => {
  const sql = await readFile(migrationPath, "utf8");
  const aiBackfill = sql.indexOf("update public.socialmedia_ai_generations g");
  const aiNotNull = sql.indexOf("alter table public.socialmedia_ai_generations alter column workspace_id set not null;");
  const keyBackfill = sql.indexOf("update public.socialmedia_api_keys k");
  const keyNotNull = sql.indexOf("alter table public.socialmedia_api_keys alter column workspace_id set not null;");

  assert.ok(aiBackfill >= 0 && aiBackfill < aiNotNull);
  assert.ok(keyBackfill >= 0 && keyBackfill < keyNotNull);
  assert.ok(sql.includes("grant execute on function public.socialmedia_record_api_request(uuid, date) to service_role;"));
});

test("Phase 32 runbook prevents blind production migration reapplication", async () => {
  const doc = await readFile(runbookPath, "utf8");

  assert.match(doc, /Confirm the exact OmniSocial Supabase project ref/i);
  assert.match(doc, /do not edit\/re-run that historical migration/i);
  assert.match(doc, /preflight/i);
  assert.match(doc, /backup\/rollback/i);
  assert.match(doc, /supabase migration list --linked/);
  assert.match(doc, /supabase db push --dry-run/);
  assert.match(doc, /Completion criteria/);
});
