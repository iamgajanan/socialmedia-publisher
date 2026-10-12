import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Threads post and account analytics use their respective provider endpoints", async () => {
  const source = await readFile("lib/analytics/sync.ts", "utf8");
  const postMetrics = source.slice(source.indexOf("async function fetchPostMetrics"), source.indexOf("async function fetchAccountMetrics"));
  const accountMetrics = source.slice(source.indexOf("async function fetchAccountMetrics"), source.indexOf("export async function syncAnalyticsForProfile"));

  assert.equal((postMetrics.match(/if \(platform === "threads"\)/g) ?? []).length, 1);
  assert.match(postMetrics, /\/\$\{encodeURIComponent\(postId\)\}\/insights/);
  assert.doesNotMatch(postMetrics, /me\/threads_insights/);
  assert.match(accountMetrics, /me\/threads_insights/);
  assert.match(accountMetrics, /followers_count/);
  assert.match(accountMetrics, /result\.follower_count = n\(value\)/);
});
