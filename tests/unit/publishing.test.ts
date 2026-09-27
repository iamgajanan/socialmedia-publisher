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
  validateThreadsPublishInput({
    content: "hello",
    media: [{ path: "image.png", url: "https://example.com/image.png", mimeType: "image/png", size: 1 }],
  });
  assert.throws(() => validateThreadsPublishInput({
    content: "hello",
    media: [
      { path: "a.png", url: "https://example.com/a.png", mimeType: "image/png", size: 1 },
      { path: "b.png", url: "https://example.com/b.png", mimeType: "image/png", size: 1 },
    ],
  }));
});
