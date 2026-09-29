import test from "node:test";
import assert from "node:assert/strict";
import { validateMediaSelection } from "../../lib/publishing/media-capabilities.ts";

test("Facebook accepts text-only posts", () => {
  assert.equal(validateMediaSelection(["facebook"], []), null);
});

test("Facebook accepts one image or one video", () => {
  assert.equal(validateMediaSelection(["facebook"], ["image/jpeg"]), null);
  assert.equal(validateMediaSelection(["facebook"], ["video/mp4"]), null);
  assert.notEqual(validateMediaSelection(["facebook"], ["image/jpeg", "image/png"]), null);
});

test("Facebook and Instagram accept one shared image or video", () => {
  assert.equal(validateMediaSelection(["facebook", "instagram"], ["image/jpeg"]), null);
  assert.equal(validateMediaSelection(["facebook", "instagram"], ["video/mp4"]), null);
  assert.notEqual(validateMediaSelection(["facebook", "instagram"], []), null);
});

test("Facebook, Instagram and Threads accept one shared image or video", () => {
  assert.equal(validateMediaSelection(["facebook", "instagram", "threads"], ["image/jpeg"]), null);
  assert.equal(validateMediaSelection(["facebook", "instagram", "threads"], ["video/mp4"]), null);
  assert.notEqual(validateMediaSelection(["facebook", "instagram", "threads"], []), null);
});

test("Facebook and Threads allow text-only publishing", () => {
  assert.equal(validateMediaSelection(["facebook", "threads"], []), null);
});
