import test from "node:test";
import assert from "node:assert/strict";

import { getMissingPlatforms, parsePublishRequest } from "../../lib/api/publish-request.ts";

test("accepts text publishing requests and deduplicates platforms", () => {
  const result = parsePublishRequest({
    platforms: ["facebook", "instagram", "facebook"],
    text: "Hello from Omnisocial API",
  });
  assert.equal(result.ok, true);
  if (result.ok) assert.deepEqual(result.data.platforms, ["facebook", "instagram"]);
});

test("accepts media-only requests", () => {
  const result = parsePublishRequest({
    platforms: ["facebook"],
    media_paths: ["profile-1/photo.jpg"],
  });
  assert.equal(result.ok, true);
});

test("rejects empty content and media", () => {
  const result = parsePublishRequest({ platforms: ["facebook"], text: "", media_paths: [] });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.message, "Provide text or at least one media file.");
});

test("rejects malformed or unsupported request fields", () => {
  assert.equal(parsePublishRequest({ platforms: ["google"], text: "hello" }).ok, false);
  assert.equal(parsePublishRequest({ platforms: ["facebook"], text: "hello", scheduled_at: "tomorrow" }).ok, false);
});

test("identifies requested platforms without connected accounts", () => {
  assert.deepEqual(
    getMissingPlatforms(["facebook", "instagram", "threads"], ["facebook", "threads"]),
    ["instagram"],
  );
});

test("rejects text longer than 5000 characters", () => {
  assert.equal(parsePublishRequest({ platforms: ["facebook"], text: "x".repeat(5001) }).ok, false);
});
