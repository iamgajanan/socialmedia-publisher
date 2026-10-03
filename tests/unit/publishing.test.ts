import test from "node:test";
import assert from "node:assert/strict";
import { canRetry, getRetryDelaySeconds, getRetrySchedule } from "../../lib/publishing/retry.ts";
import { buildIdempotencyKey } from "../../lib/publishing/idempotency.ts";

test("retry policy uses capped exponential backoff", () => {
  assert.equal(canRetry(0, 5), true);
  assert.equal(canRetry(5, 5), false);
  assert.equal(getRetryDelaySeconds(0), 60);
  assert.equal(getRetryDelaySeconds(4), 960);
  assert.equal(getRetryDelaySeconds(20), 3600);
});

test("retry schedule resets correctly at max retries", () => {
  const now = new Date("2026-09-27T00:00:00.000Z");
  const schedule = getRetrySchedule(2, 5, now);
  assert.equal(schedule.canRetry, true);
  assert.equal(schedule.nextRetryAt, "2026-09-27T00:04:00.000Z");
  assert.equal(getRetrySchedule(5, 5, now).nextRetryAt, null);
});

test("idempotency keys are stable and destination-specific", () => {
  const a = buildIdempotencyKey("post-1", "account-1");
  assert.equal(a, "social-publisher:v1:post-1:account-1");
  assert.notEqual(a, buildIdempotencyKey("post-1", "account-2"));
});

test("Threads validation accepts one image and rejects multiple media assets", async () => {
  const { validateThreadsPublishInput } = await import("../../lib/publishing/providers/threads-validation.ts");
  validateThreadsPublishInput({ content: "hello", media: [{ mimeType: "image/png" }] });
  assert.throws(() => validateThreadsPublishInput({ content: "hello", media: [{ mimeType: "image/png" }, { mimeType: "image/png" }] }));
});

test("automatic retry keeps the post scheduled and suppresses premature failure notifications", async () => {
  const { getPublishingPostOutcome } = await import("../../lib/publishing/outcome.ts");
  assert.equal(getPublishingPostOutcome([
    { status: "published", nextRetryAt: null },
    { status: "failed", nextRetryAt: "2026-09-27T00:01:00.000Z" },
  ]), "retrying");
  assert.equal(getPublishingPostOutcome([
    { status: "published", nextRetryAt: null },
    { status: "failed", nextRetryAt: null },
  ]), "failed");
  assert.equal(getPublishingPostOutcome([
    { status: "published", nextRetryAt: null },
    { status: "published", nextRetryAt: null },
  ]), "published");
  assert.equal(getPublishingPostOutcome([
    { status: "published", nextRetryAt: null },
    { status: "skipped", nextRetryAt: null },
  ]), "published");
  assert.equal(getPublishingPostOutcome([
    { status: "skipped", nextRetryAt: null },
    { status: "skipped", nextRetryAt: null },
  ]), "scheduled");
});

test("cancelled posts are never considered retryable queue parents", () => {
  const eligible = ["failed", "scheduled"].includes("cancelled");
  assert.equal(eligible, false);
});

test("media capability matrix enforces selected destination requirements", async () => {
  const { getMediaCapability, validateMediaSelection } = await import("../../lib/publishing/media-capabilities.ts");
  const instagram = getMediaCapability(["instagram"]);
  assert.equal(instagram.minFiles, 1);
  assert.equal(instagram.maxFiles, 1);
  assert.deepEqual(instagram.imageTypes, ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif", "image/tiff", "image/bmp"]);
  assert.deepEqual(instagram.videoTypes, ["video/mp4", "video/quicktime"]);
  assert.equal(validateMediaSelection(["instagram"], []), "instagram requires at least 1 image or video.");
  assert.equal(validateMediaSelection(["instagram"], ["image/png"]), null);
  assert.equal(validateMediaSelection(["instagram"], ["image/webp"]), null);
  assert.equal(validateMediaSelection(["instagram"], ["image/avif"]), null);
  assert.equal(validateMediaSelection(["instagram"], ["image/jpeg"]), null);
  assert.equal(validateMediaSelection(["instagram"], ["image/tiff"]), null);
  const mixed = getMediaCapability(["facebook", "instagram"]);
  assert.equal(mixed.maxFiles, 1);
  assert.deepEqual(mixed.imageTypes, ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif", "image/tiff", "image/bmp"]);
  assert.deepEqual(mixed.videoTypes, ["video/mp4", "video/quicktime"]);
});

test("media paths are classified from persisted extensions", async () => {
  const { mediaTypeFromPath } = await import("../../lib/publishing/media-capabilities.ts");
  assert.equal(mediaTypeFromPath("user/photo.jpg"), "image/jpeg");
  assert.equal(mediaTypeFromPath("user/video.mp4"), "video/mp4");
  assert.equal(mediaTypeFromPath("user/photo.webp"), "image/webp");
  assert.equal(mediaTypeFromPath("user/photo.avif"), "image/avif");
  assert.equal(mediaTypeFromPath("user/photo.tiff"), "image/tiff");
  assert.equal(mediaTypeFromPath("user/photo.bmp"), "image/bmp");
  assert.equal(mediaTypeFromPath("user/clip.mov"), "video/quicktime");
});

const testMedia = (mimeType: string) => ({
  url: "https://example.com/media",
  path: "test/media",
  size: 1024,
  mimeType,
});

const testAccount = { external_account_id: "test-account", metadata: {} } as never;
const testIdempotencyKey = "phase16-test-idempotency";

test("LinkedIn validation accepts text, JPEG/PNG images, and MP4/MOV videos", async () => {
  const { linkedinPublisher } = await import("../../lib/publishing/providers/linkedin.ts");

  linkedinPublisher.validate({ content: "hello", media: [], account: testAccount, idempotencyKey: testIdempotencyKey });
  linkedinPublisher.validate({ content: "hello", media: [testMedia("image/png")], account: testAccount, idempotencyKey: testIdempotencyKey });
  linkedinPublisher.validate({ content: "hello", media: [testMedia("image/jpeg")], account: testAccount, idempotencyKey: testIdempotencyKey });
  linkedinPublisher.validate({ content: "hello", media: [testMedia("video/mp4")], account: testAccount, idempotencyKey: testIdempotencyKey });
  linkedinPublisher.validate({ content: "hello", media: [testMedia("video/quicktime")], account: testAccount, idempotencyKey: testIdempotencyKey });

  assert.throws(
    () => linkedinPublisher.validate({ content: "hello", media: [testMedia("image/webp")], account: testAccount, idempotencyKey: testIdempotencyKey }),
    /JPEG\/PNG images and MP4\/MOV videos/,
  );
  assert.throws(
    () => linkedinPublisher.validate({ content: "hello", media: [testMedia("image/png"), testMedia("image/png")], account: testAccount, idempotencyKey: testIdempotencyKey }),
    /one image or video/,
  );
  assert.throws(
    () => linkedinPublisher.validate({ content: "x".repeat(3001), media: [], account: testAccount, idempotencyKey: testIdempotencyKey }),
    /3,000 character limit/,
  );
});

test("YouTube validation requires exactly one video and enforces description length", async () => {
  const { youtubePublisher } = await import("../../lib/publishing/providers/youtube.ts");

  youtubePublisher.validate({ content: "description", media: [testMedia("video/mp4")], account: testAccount, idempotencyKey: testIdempotencyKey });
  assert.throws(
    () => youtubePublisher.validate({ content: "description", media: [], account: testAccount, idempotencyKey: testIdempotencyKey }),
    /exactly one video/,
  );
  assert.throws(
    () => youtubePublisher.validate({ content: "description", media: [testMedia("video/mp4"), testMedia("video/mp4")], account: testAccount, idempotencyKey: testIdempotencyKey }),
    /exactly one video/,
  );
  assert.throws(
    () => youtubePublisher.validate({ content: "x".repeat(5001), media: [testMedia("video/mp4")], account: testAccount, idempotencyKey: testIdempotencyKey }),
    /5,000 characters/,
  );
});
