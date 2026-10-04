import assert from "node:assert/strict";
import test from "node:test";
import { getRetryDelaySeconds, getRetrySchedule, getNextRetryAt } from "../../lib/publishing/retry.ts";

test("publishing retry uses exponential backoff and caps at one hour", () => {
  assert.equal(getRetryDelaySeconds(0), 60);
  assert.equal(getRetryDelaySeconds(1), 120);
  assert.equal(getRetryDelaySeconds(6), 3600);
  assert.equal(getRetryDelaySeconds(20), 3600);
});

test("provider Retry-After overrides exponential backoff", () => {
  const now = new Date("2026-10-04T10:00:00.000Z");
  assert.equal(
    getNextRetryAt(1, now, 900).toISOString(),
    "2026-10-04T10:15:00.000Z",
  );
});

test("retry delay is capped even when provider asks for a long delay", () => {
  const now = new Date("2026-10-04T10:00:00.000Z");
  assert.equal(
    getNextRetryAt(1, now, 999999).toISOString(),
    "2026-10-04T11:00:00.000Z",
  );
});

test("retry schedule stops after max retries", () => {
  const now = new Date("2026-10-04T10:00:00.000Z");
  assert.deepEqual(getRetrySchedule(3, 3, now), {
    retryCount: 3,
    maxRetries: 3,
    canRetry: false,
    nextRetryAt: null,
  });
});
