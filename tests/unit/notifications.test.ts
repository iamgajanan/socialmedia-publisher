import test from "node:test";
import assert from "node:assert/strict";
import { canRetryNotification, getNextNotificationAttemptAt, getNotificationBackoffSeconds, MAX_NOTIFICATION_ATTEMPTS } from "../../lib/notifications/retry.ts";
import { notificationIdempotencyKey } from "../../lib/notifications/idempotency.ts";

test("notification retry policy uses capped exponential backoff", () => {
  assert.equal(getNotificationBackoffSeconds(1), 60);
  assert.equal(getNotificationBackoffSeconds(2), 120);
  assert.equal(getNotificationBackoffSeconds(5), 960);
  assert.equal(getNotificationBackoffSeconds(20), 3600);
  assert.equal(canRetryNotification(MAX_NOTIFICATION_ATTEMPTS - 1), true);
  assert.equal(canRetryNotification(MAX_NOTIFICATION_ATTEMPTS), false);
});

test("notification retry schedule is deterministic", () => {
  const now = new Date("2026-09-27T00:00:00.000Z");
  assert.equal(getNextNotificationAttemptAt(1, now).toISOString(), "2026-09-27T00:01:00.000Z");
  assert.equal(getNextNotificationAttemptAt(2, now).toISOString(), "2026-09-27T00:02:00.000Z");
});

test("dummy post notification has a stable Resend idempotency key", () => {
  const dedupeKey = "post_published:00000000-0000-4000-8000-000000000001";
  const key = notificationIdempotencyKey(dedupeKey);
  assert.equal(key, "socialmedia-notification:v1:post_published:00000000-0000-4000-8000-000000000001");
  assert.equal(notificationIdempotencyKey(dedupeKey), key);
  assert.notEqual(notificationIdempotencyKey("post_failed:00000000-0000-4000-8000-000000000001"), key);
});
