import test from "node:test";
import assert from "node:assert/strict";
import { WEBHOOK_EVENTS, isWebhookEventType } from "../../lib/webhooks/events.ts";

test("webhook event catalog contains the supported lifecycle events", () => {
  assert.ok(WEBHOOK_EVENTS.includes("post.created"));
  assert.ok(WEBHOOK_EVENTS.includes("post.published"));
  assert.ok(WEBHOOK_EVENTS.includes("account.connected"));
  assert.ok(WEBHOOK_EVENTS.includes("media.uploaded"));
});

test("webhook event validation rejects unknown events", () => {
  assert.equal(isWebhookEventType("post.published"), true);
  assert.equal(isWebhookEventType("post.unknown"), false);
});
