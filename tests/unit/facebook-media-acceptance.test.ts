import test from "node:test";
import assert from "node:assert/strict";
import { getMediaCapability, validateMediaSelection } from "../../lib/publishing/media-capabilities.ts";

test("Facebook accepts text-only posts", () => {
  assert.equal(validateMediaSelection(["facebook"], []), null);
  assert.deepEqual(getMediaCapability(["facebook"]), {
    minFiles: 0,
    maxFiles: 1,
    imageTypes: ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif", "image/tiff", "image/bmp"],
    videoTypes: ["video/mp4", "video/webm", "video/quicktime", "video/x-matroska"],
  });
});

test("Facebook accepts one image or one video", () => {
  assert.equal(validateMediaSelection(["facebook"], ["image/jpeg"]), null);
  assert.equal(validateMediaSelection(["facebook"], ["video/mp4"]), null);
  assert.notEqual(validateMediaSelection(["facebook"], ["image/jpeg", "image/png"]), null);
});

test("Facebook and Instagram share one-media image and video combinations", () => {
  assert.equal(validateMediaSelection(["facebook", "instagram"], ["image/jpeg"]), null);
  assert.equal(validateMediaSelection(["facebook", "instagram"], ["video/mp4"]), null);
  assert.notEqual(validateMediaSelection(["facebook", "instagram"], []), null);
  assert.notEqual(validateMediaSelection(["facebook", "instagram"], ["image/gif"]), null);
});

test("Facebook, Instagram and Threads share the supported one-media combinations", () => {
  assert.equal(validateMediaSelection(["facebook", "instagram", "threads"], ["image/jpeg"]), null);
  assert.equal(validateMediaSelection(["facebook", "instagram", "threads"], ["video/mp4"]), null);
  assert.notEqual(validateMediaSelection(["facebook", "instagram", "threads"], []), null);
});

test("Facebook and Threads allow text-only publishing", () => {
  assert.equal(validateMediaSelection(["facebook", "threads"], []), null);
});
