import test from "node:test";
import assert from "node:assert/strict";

const base = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";
const response = await fetch(`${base}/auth/login`, { redirect: "manual" });

test("production build serves the login page", async () => {
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /text\/html/);
});

test("protected dashboard redirects unauthenticated users", async () => {
  const dashboard = await fetch(`${base}/dashboard`, { redirect: "manual" });
  assert.ok([302, 307, 308].includes(dashboard.status), `unexpected status ${dashboard.status}`);
});
