import test from "node:test";
import assert from "node:assert/strict";
import { buildFacebookPublishRequest } from "../../lib/publishing/providers/meta-facebook-request.ts";

test("Facebook text publishing targets the persisted Page ID and Page token", () => {
  const request = buildFacebookPublishRequest("v21.0", "page-123", "page-token", "Hello Facebook");

  assert.equal(request.url, "https://graph.facebook.com/v21.0/page-123/feed");
  assert.equal(request.body.get("message"), "Hello Facebook");
  assert.equal(request.body.get("access_token"), "page-token");
});

test("Facebook image publishing sends the public media URL to the Page photos endpoint", () => {
  const request = buildFacebookPublishRequest(
    "v21.0",
    "page-123",
    "page-token",
    "Image caption",
    { url: "https://cdn.example.com/image.jpg", mimeType: "image/jpeg" },
  );

  assert.equal(request.url, "https://graph.facebook.com/v21.0/page-123/photos");
  assert.equal(request.body.get("url"), "https://cdn.example.com/image.jpg");
  assert.equal(request.body.get("caption"), "Image caption");
  assert.equal(request.body.get("access_token"), "page-token");
});
