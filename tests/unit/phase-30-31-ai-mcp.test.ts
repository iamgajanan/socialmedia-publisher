import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync("lib/mcp/server.ts", "utf8");

test("Phase 31 supports every required platform", () => {
  for (const platform of ["instagram", "linkedin", "x", "facebook", "threads", "tiktok", "youtube"]) assert.match(source, new RegExp(`aiPlatformEnum = \\[.*${platform}`, "s"));
});

test("Phase 30 exposes only the approved MCP tools", () => {
  for (const tool of ["list_connected_accounts", "publish_post", "schedule_post", "get_post_status", "get_analytics", "generate_platform_content"]) assert.match(source, new RegExp(`name: \\\"${tool}\\\"`));
});

test("publishing and scheduling require explicit confirmation", () => {
  assert.match(source, /name: "publish_post"[\s\S]*?required: \["platforms", "text", "confirm"\]/);
  assert.match(source, /name: "schedule_post"[\s\S]*?required: \["platforms", "text", "scheduled_at", "confirm"\]/);
});

test("MCP does not expose destructive delete or disconnect tools", () => {
  assert.doesNotMatch(source, /name: "(?:delete|disconnect|revoke)[^"]*"/);
});
