import assert from "node:assert/strict";
import test from "node:test";
import { AI_PLATFORMS } from "../../lib/ai/content-engine.ts";
import { MCP_TOOLS } from "../../lib/mcp/server.ts";

test("Phase 31 supports every required platform", () => {
  assert.deepEqual([...AI_PLATFORMS], ["instagram", "linkedin", "x", "facebook", "threads", "tiktok", "youtube"]);
});

test("Phase 30 exposes only the approved MCP tools", () => {
  assert.deepEqual(MCP_TOOLS.map((tool) => tool.name), [
    "list_connected_accounts",
    "publish_post",
    "schedule_post",
    "get_post_status",
    "get_analytics",
    "generate_platform_content",
  ]);
});

test("publishing and scheduling require explicit confirmation", () => {
  const publish = MCP_TOOLS.find((tool) => tool.name === "publish_post");
  const schedule = MCP_TOOLS.find((tool) => tool.name === "schedule_post");
  assert.ok(publish);
  assert.ok(schedule);
  assert.ok(Array.isArray(publish.inputSchema.required) && publish.inputSchema.required.includes("confirm"));
  assert.ok(Array.isArray(schedule.inputSchema.required) && schedule.inputSchema.required.includes("confirm"));
});

test("MCP does not expose destructive delete or disconnect tools", () => {
  assert.equal(MCP_TOOLS.some((tool) => /delete|disconnect|revoke/i.test(tool.name)), false);
});
