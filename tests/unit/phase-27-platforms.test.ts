import test from "node:test";
import assert from "node:assert/strict";
import { getMediaCapability, getPlatformMediaIssues } from "../../lib/publishing/media-capabilities.ts";

test("Phase 27 media capabilities cover the new platforms", () => {
  assert.equal(getMediaCapability(["bluesky"]).maxFiles, 4);
  assert.equal(getMediaCapability(["google_business_profile"]).maxFiles, 1);
  assert.equal(getMediaCapability(["reddit"]).maxFiles, 0);
});

test("Phase 27 media warnings are platform specific", () => {
  assert.match(getPlatformMediaIssues(["reddit"], ["image/png"])[0].message, /text posts only/i);
  assert.match(getPlatformMediaIssues(["google_business_profile"], ["video/mp4"])[0].message, /image media only/i);
  assert.match(getPlatformMediaIssues(["bluesky"], ["video/mp4"])[0].message, /image media only/i);
});
