import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("dashboard navigation exposes Team & access", () => {
  const source = fs.readFileSync("components/dashboard-sidebar.tsx", "utf8");
  assert.match(source, /href:\s*"\/team"/);
  assert.match(source, /label:\s*"Team & access"/);
});
