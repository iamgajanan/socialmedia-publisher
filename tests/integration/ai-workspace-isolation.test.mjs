import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const contentRoute = readFileSync("app/api/ai/content/route.ts", "utf8");
const approvalsRoute = readFileSync("app/api/ai/approvals/route.ts", "utf8");
const apiContentRoute = readFileSync("app/api/v1/ai/content/[id]/route.ts", "utf8");
const apiGenerateRoute = readFileSync("app/api/v1/ai/content/route.ts", "utf8");
const contentEngine = readFileSync("lib/ai/content-engine.ts", "utf8");
const workspaceContext = readFileSync("lib/workspace/api-context.ts", "utf8");

test("AI history and generation APIs resolve a trusted active workspace", () => {
  assert.match(workspaceContext, /from\("socialmedia_profiles"\)[\s\S]*?select\("workspace_id"\)/);
  assert.match(workspaceContext, /from\("socialmedia_workspace_members"\)[\s\S]*?eq\("status", "active"\)/);
  assert.match(contentRoute, /getApiWorkspaceContext\(\)/);
  assert.match(contentRoute, /eq\("workspace_id", context\.workspaceId\)/);
  assert.match(contentRoute, /workspaceId: context\.workspaceId/);
});

test("approval queue and rejection mutations stay inside the active workspace", () => {
  assert.match(approvalsRoute, /eq\("workspace_id", context\.workspaceId\)/);
  assert.match(approvalsRoute, /approveGeneration\(context\.profileId, context\.workspaceId, generationId, context\.profileId\)/);
  assert.match(approvalsRoute, /update\(\{ status: "rejected"[\s\S]*?eq\("workspace_id", context\.workspaceId\)/);
});

test("generation detail and approval helpers require workspace-scoped queries", () => {
  const getGeneration = contentEngine.slice(
    contentEngine.indexOf("export async function getGeneration"),
    contentEngine.indexOf("export async function approveGeneration"),
  );
  const approveGeneration = contentEngine.slice(contentEngine.indexOf("export async function approveGeneration"));

  assert.match(getGeneration, /eq\("workspace_id", workspaceId\)/);
  assert.match(getGeneration, /socialmedia_ai_content_variants[\s\S]*?eq\("workspace_id", workspaceId\)/);
  assert.match(approveGeneration, /eq\("workspace_id", workspaceId\)/);
  assert.match(approveGeneration, /socialmedia_ai_content_variants[\s\S]*?eq\("workspace_id", workspaceId\)/);
  assert.match(apiContentRoute, /getGeneration\(auth\.profileId, auth\.workspaceId, id\)/);
  assert.match(apiContentRoute, /approveGeneration\(auth\.profileId, auth\.workspaceId, id, auth\.profileId\)/);
});

test("public AI generation carries the API key's verified workspace", () => {
  assert.match(apiGenerateRoute, /workspaceId: auth\.workspaceId/);
});
