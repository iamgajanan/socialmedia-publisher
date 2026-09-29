import test from "node:test";
import assert from "node:assert/strict";

import {
  parsePostListQuery,
  parsePostManagementPatch,
  getEditablePostStatuses,
} from "../../lib/api/post-management-core.ts";

test("post list query applies safe defaults", () => {
  const result = parsePostListQuery(new URLSearchParams());
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.data.limit, 20);
    assert.equal(result.data.offset, 0);
  }
});

test("post list query accepts status, platform and date filters", () => {
  const result = parsePostListQuery(new URLSearchParams({
    status: "scheduled",
    platform: "instagram",
    from: "2026-10-01T00:00:00.000Z",
    to: "2026-10-02T00:00:00.000Z",
    limit: "10",
    offset: "20",
  }));
  assert.equal(result.ok, true);
});

test("post list query rejects an invalid date range", () => {
  const result = parsePostListQuery(new URLSearchParams({
    from: "2026-10-02T00:00:00.000Z",
    to: "2026-10-01T00:00:00.000Z",
  }));
  assert.equal(result.ok, false);
});

test("post update accepts content and future scheduling", () => {
  const result = parsePostManagementPatch({
    content: "updated",
    scheduled_at: "2099-01-01T10:00:00.000Z",
  });
  assert.equal(result.ok, true);
});

test("post update rejects past scheduling and empty updates", () => {
  assert.equal(parsePostManagementPatch({ scheduled_at: "2020-01-01T00:00:00.000Z" }).ok, false);
  assert.equal(parsePostManagementPatch({}).ok, false);
});

test("only drafts and scheduled posts are editable", () => {
  assert.deepEqual(getEditablePostStatuses(), ["draft", "scheduled"]);
});
