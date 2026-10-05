import test from "node:test";
import assert from "node:assert/strict";

import { getPlatformMediaIssues, PLATFORM_MEDIA_CAPABILITIES } from "../../lib/publishing/media-capabilities.ts";

test("Pinterest supports one standard image in OmniSocial", () => {
  assert.deepEqual(PLATFORM_MEDIA_CAPABILITIES.pinterest, {
    minFiles: 1,
    maxFiles: 1,
    imageTypes: ["image/jpeg", "image/png", "image/webp"],
    videoTypes: [],
  });
  assert.deepEqual(getPlatformMediaIssues(["pinterest"], ["image/jpeg"]), []);
});

test("Pinterest reports a destination-specific video limitation", () => {
  const issues = getPlatformMediaIssues(["pinterest"], ["video/mp4"]);
  assert.equal(issues.length, 1);
  assert.match(issues[0].message, /Pinterest integration supports image Pins only/i);
});

test("Pinterest rejects multiple images in the current Pin flow", () => {
  const issues = getPlatformMediaIssues(["pinterest"], ["image/jpeg", "image/png"]);
  assert.equal(issues.length, 1);
  assert.match(issues[0].message, /at most 1 media file/i);
});
