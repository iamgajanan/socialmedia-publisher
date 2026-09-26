import test from "node:test";
import assert from "node:assert/strict";
import { isValidTimeZone, normalizeTimeZone, zonedDateTimeToUtc } from "../../lib/scheduling/timezone.ts";

test("normalizes missing and invalid timezones", () => {
  assert.equal(normalizeTimeZone(undefined), "Asia/Kolkata");
  assert.equal(normalizeTimeZone("Invalid/Zone"), "Asia/Kolkata");
  assert.equal(normalizeTimeZone("UTC"), "UTC");
  assert.equal(isValidTimeZone("Europe/London"), true);
  assert.equal(isValidTimeZone("Nope/Zone"), false);
});

test("converts an India local datetime to UTC", () => {
  assert.equal(zonedDateTimeToUtc("2026-09-27T10:30", "Asia/Kolkata")?.toISOString(), "2026-09-27T05:00:00.000Z");
});

test("rejects impossible local dates", () => {
  assert.equal(zonedDateTimeToUtc("2026-02-30T10:30", "Asia/Kolkata"), null);
});
