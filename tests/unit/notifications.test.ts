import test from "node:test";
import assert from "node:assert/strict";
import { canRetryNotification, getNextNotificationAttemptAt, getNotificationBackoffSeconds, MAX_NOTIFICATION_ATTEMPTS } from "../../lib/notifications/retry.ts";
import { notificationIdempotencyKey } from "../../lib/notifications/idempotency.ts";
import { renderNotificationEmail, getPostTitle } from "../../lib/notifications/email.ts";

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


test("published notification renders post title, destinations, and publish time", () => {
  const email = renderNotificationEmail("post_published", {
    postId: "00000000-0000-4000-8000-000000000001",
    postTitle: "My launch post",
    platforms: ["threads", "instagram", "facebook"],
    publishedAt: "2026-09-28T05:18:14.000Z",
    timezone: "Asia/Kolkata",
  });

  assert.equal(email.subject, "Post published successfully");
  assert.match(email.html, /My launch post/);
  assert.match(email.html, /Threads, Instagram, Facebook/);
  assert.match(email.html, /Published at/);
  assert.match(email.html, /Post ID/);
});

test("scheduled notification renders post title, destinations, and scheduled time", () => {
  const email = renderNotificationEmail("post_scheduled", {
    postId: "00000000-0000-4000-8000-000000000002",
    postTitle: "Weekend campaign",
    platforms: ["threads", "instagram"],
    scheduledAt: "2026-09-28T06:00:00.000Z",
    timezone: "Asia/Kolkata",
  });

  assert.equal(email.subject, "Post scheduled");
  assert.match(email.html, /Weekend campaign/);
  assert.match(email.html, /Threads, Instagram/);
  assert.match(email.html, /Scheduled for/);
  assert.match(email.html, /28 Sept 2026/);
  assert.match(email.html, /Asia\/Kolkata/);
});

test("post title is derived cleanly from the first content line", () => {
  assert.equal(getPostTitle("My post title\nThe rest of the content"), "My post title");
  assert.equal(getPostTitle(""), "Untitled post");
});
