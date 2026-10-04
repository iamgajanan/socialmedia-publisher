import test from "node:test";
import assert from "node:assert/strict";

import {
  getMediaCapability,
  getPlatformMediaIssues,
  getUploadMediaCapability,
  validateMediaSelection,
} from "../../lib/publishing/media-capabilities.ts";

test("LinkedIn allows text-only posts and optional image/video media", () => {
  const capability = getMediaCapability(["linkedin"]);

  assert.equal(capability.minFiles, 0);
  assert.equal(capability.maxFiles, 1);
  assert.ok(capability.imageTypes.includes("image/jpeg"));
  assert.ok(capability.videoTypes.includes("video/mp4"));
  assert.equal(validateMediaSelection(["linkedin"], []), null);
});

test("LinkedIn plus YouTube requires a video and rejects an image", () => {
  const capability = getMediaCapability(["linkedin", "youtube"]);

  assert.equal(capability.minFiles, 1);
  assert.deepEqual(capability.imageTypes, []);
  assert.ok(capability.videoTypes.includes("video/mp4"));
  assert.match(validateMediaSelection(["linkedin", "youtube"], []) ?? "", /requires at least 1 video/);
  assert.match(validateMediaSelection(["linkedin", "youtube"], ["image/jpeg"]) ?? "", /not supported/);
  assert.equal(validateMediaSelection(["linkedin", "youtube"], ["video/mp4"]), null);
});

test("Uploader accepts media supported by any selected destination", () => {
  const capability = getUploadMediaCapability(["instagram", "youtube"]);

  assert.equal(capability.minFiles, 0);
  assert.equal(capability.maxFiles, 10);
  assert.ok(capability.imageTypes.includes("image/jpeg"));
  assert.ok(capability.videoTypes.includes("video/mp4"));
});

test("YouTube image selection gives an actionable product-specific message", () => {
  const issues = getPlatformMediaIssues(["instagram", "youtube"], ["image/png"]);

  assert.equal(issues.length, 1);
  assert.equal(issues[0]?.platform, "youtube");
  assert.match(issues[0]?.message ?? "", /supports video uploads only/i);
  assert.match(issues[0]?.message ?? "", /Remove YouTube/i);
});

test("Instagram image carousels are allowed while mixed image/video carousels are rejected", () => {
  assert.equal(getPlatformMediaIssues(["instagram"], ["image/jpeg", "image/png"]).length, 0);
  assert.match(
    getPlatformMediaIssues(["instagram"], ["image/jpeg", "video/mp4"])[0]?.message ?? "",
    /cannot mix images and videos/i,
  );
});
