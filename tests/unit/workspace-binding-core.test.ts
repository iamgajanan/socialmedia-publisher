import assert from "node:assert/strict";
import test from "node:test";
import { isWorkspaceBindingValid } from "../../lib/api/workspace-binding-core.ts";

test("accepts only an exact non-empty API key/profile workspace match", () => {
  assert.equal(isWorkspaceBindingValid("workspace-a", "workspace-a"), true);
  assert.equal(isWorkspaceBindingValid("workspace-a", "workspace-b"), false);
  assert.equal(isWorkspaceBindingValid("workspace-a", null), false);
  assert.equal(isWorkspaceBindingValid(null, "workspace-a"), false);
  assert.equal(isWorkspaceBindingValid("", ""), false);
});
