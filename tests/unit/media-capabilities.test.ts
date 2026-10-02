import test from "node:test";
import assert from "node:assert/strict";

import { getMediaCapability, validateMediaSelection } from "../../lib/publishing/media-capabilities.ts";

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
  assert.match(validateMediaSelection(["linkedin", "youtube"], [] ) ?? "", /requires at least 1 video/);
  assert.match(validateMediaSelection(["linkedin", "youtube"], ["image/jpeg"]) ?? "", /not supported/);
  assert.equal(validateMediaSelection(["linkedin", "youtube"], ["video/mp4"]), null);
});
