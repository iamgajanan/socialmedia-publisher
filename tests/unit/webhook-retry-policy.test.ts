import assert from "node:assert/strict";
import test from "node:test";
import { isRetryableWebhookStatus } from "../../lib/webhooks/retry-policy.ts";

test("retries timeouts, rate limits, and server failures", () => {
  for (const status of [408, 429, 500, 502, 503, 599]) assert.equal(isRetryableWebhookStatus(status), true, String(status));
});

test("does not retry redirects or permanent client failures", () => {
  for (const status of [300, 301, 302, 307, 308, 400, 401, 403, 404, 410, 422]) {
    assert.equal(isRetryableWebhookStatus(status), false, String(status));
  }
});
