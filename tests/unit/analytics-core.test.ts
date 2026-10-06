import assert from "node:assert/strict";
import test from "node:test";
import {
  addAnalyticsTotals,
  emptyAnalyticsTotals,
  engagementRate,
  interactionCount,
  parseAnalyticsQuery,
} from "../../lib/api/analytics-core.ts";

test("analytics query defaults to the previous 30 days", () => {
  const before = Date.now();
  const parsed = parseAnalyticsQuery(new URLSearchParams());
  const after = Date.now();

  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;

  const from = new Date(parsed.data.from).getTime();
  const to = new Date(parsed.data.to).getTime();
  assert.ok(to >= before && to <= after);
  assert.equal(to - from, 30 * 24 * 60 * 60 * 1000);
});

test("analytics query accepts comma-separated platform filters", () => {
  const parsed = parseAnalyticsQuery(new URLSearchParams({
    from: "2026-10-01T00:00:00Z",
    to: "2026-10-06T00:00:00Z",
    platform: "instagram, linkedin,instagram",
  }));

  assert.deepEqual(parsed, {
    ok: true,
    data: {
      from: "2026-10-01T00:00:00.000Z",
      to: "2026-10-06T00:00:00.000Z",
      platforms: ["instagram", "linkedin"],
    },
  });
});

test("analytics query rejects unsupported platforms and invalid ranges", () => {
  const invalidPlatform = parseAnalyticsQuery(new URLSearchParams({ platform: "instagram,unknown" }));
  assert.equal(invalidPlatform.ok, false);

  const invalidRange = parseAnalyticsQuery(new URLSearchParams({
    from: "2026-10-06T00:00:00Z",
    to: "2026-10-01T00:00:00Z",
  }));
  assert.equal(invalidRange.ok, false);
});

test("analytics totals aggregate supported metrics and calculate engagement", () => {
  const totals = emptyAnalyticsTotals();
  addAnalyticsTotals(totals, {
    impressions: 1000,
    reach: 700,
    likes: 40,
    comments: 10,
    shares: 5,
    saves: 5,
    clicks: 25,
    video_views: 300,
  });
  addAnalyticsTotals(totals, { impressions: 500, likes: 10 });

  assert.equal(totals.impressions, 1500);
  assert.equal(interactionCount(totals), 70);
  assert.equal(engagementRate(totals), 4.6667);
});

test("engagement rate is null when impressions are unavailable", () => {
  assert.equal(engagementRate(emptyAnalyticsTotals()), null);
});
