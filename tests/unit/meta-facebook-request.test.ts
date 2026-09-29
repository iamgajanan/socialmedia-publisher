import test from "node:test";
import assert from "node:assert/strict";
import { buildFacebookPublishRequest } from "../../lib/publishing/providers/meta-facebook-request.ts";

test("Facebook text publishing targets the persisted Page ID and keeps the token in the request body", () => {
  const request = buildFacebookPublishRequest("v21.0", "page-123", "page-token", "Hello Facebook");

  assert.equal(request.url, "https://graph.facebook.com/v21.0/page-123/feed");
  assert.equal(request.body.get("message"), "Hello Facebook");
  assert.equal(request.body.get("access_token"), "page-token");
  assert.equal(request.body.has("url"), false);
  assert.equal(request.body.has("file_url"), false);
});

test("Facebook image publishing targets the Page photos endpoint", () => {
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
  assert.equal(request.body.has("file_url"), false);
});

test("Facebook video publishing targets the Page videos endpoint", () => {
  const request = buildFacebookPublishRequest(
    "v21.0",
    "page-123",
    "page-token",
    "Video description",
    { url: "https://cdn.example.com/video.mp4", mimeType: "video/mp4" },
  );

  assert.equal(request.url, "https://graph.facebook.com/v21.0/page-123/videos");
  assert.equal(request.body.get("file_url"), "https://cdn.example.com/video.mp4");
  assert.equal(request.body.get("description"), "Video description");
  assert.equal(request.body.get("access_token"), "page-token");
  assert.equal(request.body.has("url"), false);
});

test("Facebook Page IDs are URL encoded", () => {
  const request = buildFacebookPublishRequest("v21.0", "page/123", "page-token", "Hello");
  assert.equal(request.url, "https://graph.facebook.com/v21.0/page%2F123/feed");
});

test("Facebook request builder rejects missing Graph API credentials", () => {
  assert.throws(() => buildFacebookPublishRequest("v21.0", "", "token", "Hello"), /Page ID is required/);
  assert.throws(() => buildFacebookPublishRequest("v21.0", "page", "", "Hello"), /Page access token is required/);
  assert.throws(() => buildFacebookPublishRequest("", "page", "token", "Hello"), /Graph API version is required/);
});
