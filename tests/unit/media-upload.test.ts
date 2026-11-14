import test from "node:test";
import assert from "node:assert/strict";

import {
  API_MEDIA_MAX_BYTES,
  isSupportedApiMediaType,
  parseMediaUploadMetadata,
  sanitizeMediaFilename,
} from "../../lib/api/media-upload-core.ts";

test("accepts supported image metadata", () => {
  const result = parseMediaUploadMetadata({
    contentType: "image/jpeg",
    size: 1024,
    filename: "Before-Mobile.jpg",
  });
  assert.equal(result.success, true);
});

test("rejects unsupported media types", () => {
  assert.equal(isSupportedApiMediaType("application/x-executable"), false);
  const result = parseMediaUploadMetadata({
    contentType: "application/x-executable",
    size: 1024,
    filename: "document.bin",
  });
  assert.equal(result.success, false);
});

test("rejects media larger than the API limit", () => {
  const result = parseMediaUploadMetadata({
    contentType: "image/jpeg",
    size: API_MEDIA_MAX_BYTES + 1,
    filename: "large.jpg",
  });
  assert.equal(result.success, false);
});

test("sanitizes unsafe filenames without allowing path traversal", () => {
  const filename = sanitizeMediaFilename("../../my photo.jpg");
  assert.equal(filename.includes(".."), false);
  assert.equal(filename.includes("/"), false);
  assert.equal(filename.includes("my photo.jpg"), true);
});

test("accepts PDF documents for LinkedIn publishing", () => {
  assert.equal(isSupportedApiMediaType("application/pdf"), true);
  assert.equal(parseMediaUploadMetadata({ contentType: "application/pdf", size: 4096, filename: "carousel.pdf" }).success, true);
});
