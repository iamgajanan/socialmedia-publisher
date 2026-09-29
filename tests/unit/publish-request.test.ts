import test from "node:test";
import assert from "node:assert/strict";

import { getMissingPlatforms, parsePublishRequest } from "../../lib/api/publish-request.ts";

test("accepts text requests and deduplicates platforms", () => {
  const result = parsePublishRequest({
    platforms: ["facebook", "instagram", "facebook"],
    text: "hello",
  });
  assert.equal(result.ok, true);
  if (result.ok) assert.deepEqual(result.data.platforms, ["facebook", "instagram"]);
});

test("accepts media-only requests", () => {
  const result = parsePublishRequest({
    platforms: ["instagram"],
    media_paths: ["profile/photo.jpg"],
  });
  assert.equal(result.ok, true);
});

test("rejects empty publish requests", () => {
  const result = parsePublishRequest({
    platforms: ["facebook"],
    text: "   ",
  });
  assert.equal(result.ok, false);
});

test("rejects unknown request fields", () => {
  const result = parsePublishRequest({
    platforms: ["facebook"],
    text: "hello",
    unknown: true,
  });
  assert.equal(result.ok, false);
});

test("reports missing connected platforms", () => {
  assert.deepEqual(
    getMissingPlatforms(["facebook", "instagram"], ["facebook"]),
    ["instagram"],
  );
});

test("rejects text longer than 5000 characters", () => {
  const result = parsePublishRequest({
    platforms: ["facebook"],
    text: "x".repeat(5001),
  });
  assert.equal(result.ok, false);
});

test("accepts a future scheduled_at timestamp", () => {
  const result = parsePublishRequest({
    platforms: ["facebook"],
    text: "scheduled",
    scheduled_at: "2099-01-01T10:00:00.000Z",
  });
  assert.equal(result.ok, true);
});

test("rejects a past scheduled_at timestamp", () => {
  const result = parsePublishRequest({
    platforms: ["facebook"],
    text: "scheduled",
    scheduled_at: "2020-01-01T10:00:00.000Z",
  });
  assert.equal(result.ok, false);
});
