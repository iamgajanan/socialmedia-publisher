import test from "node:test";
import assert from "node:assert/strict";
import { getMediaCapability, getPlatformMediaIssues } from "../../lib/publishing/media-capabilities.ts";
import { blueskyPublisher } from "../../lib/publishing/providers/bluesky.ts";
import { googleBusinessProfilePublisher } from "../../lib/publishing/providers/google-business-profile.ts";
import { redditPublisher } from "../../lib/publishing/providers/reddit.ts";

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

test("new publisher validators reject unsupported content", () => {
  assert.throws(() => blueskyPublisher.validate({ account: {} as never, content: "x".repeat(301), media: [], idempotencyKey: "x" }), /300 characters/);
  assert.throws(() => googleBusinessProfilePublisher.validate({ account: {} as never, content: "hello", media: [{ path: "x", url: "https://example.com/x.mp4", mimeType: "video/mp4", size: 1 }], idempotencyKey: "x" }), /image media only/i);
  assert.throws(() => redditPublisher.validate({ account: { metadata: {} } as never, content: "hello", media: [], idempotencyKey: "x" }), /subreddit destination/i);
});
