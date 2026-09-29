import test from "node:test";
import assert from "node:assert/strict";

import {
  INSTAGRAM_IMAGE_MAX_BYTES,
  MAX_MEDIA_BYTES,
  validateInstagramPreparedImage,
  validateMediaMetadata,
  hasVideoContainerSignature,
} from "../../lib/publishing/media-validation.ts";

const image = {
  path: "profile/image.jpg",
  url: "https://example.com/image.jpg",
  mimeType: "image/jpeg",
  size: 0,
};

test("media metadata accepts a valid image", () => {
  assert.equal(
    validateMediaMetadata(image, {
      width: 1080,
      height: 1350,
      size: 1024,
      mimeType: "image/jpeg",
    }),
    null,
  );
});

test("media metadata rejects oversized and mismatched assets", () => {
  assert.match(
    validateMediaMetadata(image, {
      width: 1080,
      height: 1350,
      size: MAX_MEDIA_BYTES + 1,
      mimeType: "image/jpeg",
    }) ?? "",
    /100 MB/,
  );

  assert.match(
    validateMediaMetadata(image, {
      width: 1080,
      height: 1350,
      size: 1024,
      mimeType: "image/png",
    }) ?? "",
    /does not match/,
  );
});

test("media metadata rejects images with excessive pixel counts", () => {
  assert.match(
    validateMediaMetadata(image, {
      width: 20_000,
      height: 10_000,
      size: 1024,
      mimeType: "image/jpeg",
    }) ?? "",
    /pixel count/,
  );
});

test("Instagram prepared image enforces JPEG, size, width and aspect ratio", () => {
  assert.equal(
    validateInstagramPreparedImage({
      width: 1080,
      height: 1350,
      size: 1024,
      mimeType: "image/jpeg",
    }),
    null,
  );

  assert.match(
    validateInstagramPreparedImage({
      width: 1080,
      height: 1350,
      size: INSTAGRAM_IMAGE_MAX_BYTES + 1,
      mimeType: "image/jpeg",
    }) ?? "",
    /8 MB/,
  );

  assert.match(
    validateInstagramPreparedImage({
      width: 200,
      height: 250,
      size: 1024,
      mimeType: "image/jpeg",
    }) ?? "",
    /320/,
  );

  assert.match(
    validateInstagramPreparedImage({
      width: 1080,
      height: 1080,
      size: 1024,
      mimeType: "image/png",
    }) ?? "",
    /JPEG/,
  );
});

test("video container signatures are checked before provider publishing", () => {
  const mp4 = new Uint8Array([
    0, 0, 0, 24,
    0x66, 0x74, 0x79, 0x70,
    0x69, 0x73, 0x6f, 0x6d,
  ]);
  const webm = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3]);

  assert.equal(hasVideoContainerSignature("video/mp4", mp4), true);
  assert.equal(hasVideoContainerSignature("video/webm", webm), true);
  assert.equal(hasVideoContainerSignature("video/mp4", webm), false);
});
