import assert from "node:assert/strict";
import test from "node:test";
import { isActiveWorkspaceMembership } from "../../lib/api/workspace-binding-core.ts";

test("accepts only an active membership for the API key workspace", () => {
  assert.equal(isActiveWorkspaceMembership("workspace-a", ["workspace-a", "workspace-b"]), true);
  assert.equal(isActiveWorkspaceMembership("workspace-c", ["workspace-a", "workspace-b"]), false);
  assert.equal(isActiveWorkspaceMembership("workspace-a", []), false);
  assert.equal(isActiveWorkspaceMembership(null, ["workspace-a"]), false);
  assert.equal(isActiveWorkspaceMembership("", [""]), false);
});
