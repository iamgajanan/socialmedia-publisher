import test from "node:test";
import assert from "node:assert/strict";

import { linkedinPublisher } from "../../lib/publishing/providers/linkedin.ts";

test("LinkedIn accepts text-only posts", () => {
  assert.doesNotThrow(() => linkedinPublisher.validate({
    account: {
      id: "account",
      platform: "linkedin",
      external_account_id: "person",
      account_name: "Test User",
      username: null,
      metadata: {},
      token_expires_at: null,
    },
    content: "Hello LinkedIn",
    media: [],
    idempotencyKey: "test",
  }));
});

test("LinkedIn accepts one supported image", () => {
  assert.doesNotThrow(() => linkedinPublisher.validate({
    account: {
      id: "account",
      platform: "linkedin",
      external_account_id: "person",
      account_name: "Test User",
      username: null,
      metadata: {},
      token_expires_at: null,
    },
    content: "Image post",
    media: [{ path: "image.png", url: "https://example.com/image.png", mimeType: "image/png", size: 1000 }],
    idempotencyKey: "test",
  }));
});

test("LinkedIn accepts one supported video", () => {
  assert.doesNotThrow(() => linkedinPublisher.validate({
    account: {
      id: "account",
      platform: "linkedin",
      external_account_id: "person",
      account_name: "Test User",
      username: null,
      metadata: {},
      token_expires_at: null,
    },
    content: "Video post",
    media: [{ path: "video.mp4", url: "https://example.com/video.mp4", mimeType: "video/mp4", size: 1000 }],
    idempotencyKey: "test",
  }));
});

test("LinkedIn rejects unsupported media and multiple files", () => {
  assert.throws(() => linkedinPublisher.validate({
    account: {
      id: "account",
      platform: "linkedin",
      external_account_id: "person",
      account_name: "Test User",
      username: null,
      metadata: {},
      token_expires_at: null,
    },
    content: "Document post",
    media: [{ path: "file.pdf", url: "https://example.com/file.pdf", mimeType: "application/pdf", size: 1000 }],
    idempotencyKey: "test",
  }), /JPEG\/PNG images and MP4\/MOV videos/);

  assert.throws(() => linkedinPublisher.validate({
    account: {
      id: "account",
      platform: "linkedin",
      external_account_id: "person",
      account_name: "Test User",
      username: null,
      metadata: {},
      token_expires_at: null,
    },
    content: "Multiple media",
    media: [
      { path: "one.png", url: "https://example.com/one.png", mimeType: "image/png", size: 1000 },
      { path: "two.png", url: "https://example.com/two.png", mimeType: "image/png", size: 1000 },
    ],
    idempotencyKey: "test",
  }), /one image or video/);
});
