import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const createRoute = readFileSync("app/api/v1/webhooks/route.ts", "utf8");
const updateRoute = readFileSync("app/api/v1/webhooks/[id]/route.ts", "utf8");
const worker = readFileSync("lib/webhooks/worker.ts", "utf8");
const urlSafety = readFileSync("lib/webhooks/url-safety.ts", "utf8");

test("webhook create and update routes validate destinations with the shared URL policy", () => {
  assert.match(createRoute, /validateWebhookUrl\(url\)/);
  assert.match(updateRoute, /validateWebhookUrl\(url\)/);
  assert.match(createRoute, /publicly routable HTTPS URL/);
  assert.match(updateRoute, /publicly routable HTTPS URL/);
});

test("worker sends directly to a pinned public HTTPS address without redirect-following fetch", () => {
  assert.match(worker, /postPublicHttpsJson\(webhook\.url/);
  assert.doesNotMatch(worker, /fetch\(webhook\.url/);
  assert.match(urlSafety, /lookup\(hostname, \{ all: true, verbatim: true \}\)/);
  assert.match(urlSafety, /lookup: pinnedLookup/);
  assert.match(urlSafety, /httpsRequest\(url/);
});

test("public IP checks normalize IPv6 and reject non-public hostname suffixes", () => {
  assert.match(urlSafety, /function ipv6Parts/);
  assert.match(urlSafety, /inV6Range\(address, "2000::", 3\)/);
  assert.match(urlSafety, /\["2001:db8::", 32\]/);
  assert.match(urlSafety, /"\.arpa", "\.onion"/);
});
