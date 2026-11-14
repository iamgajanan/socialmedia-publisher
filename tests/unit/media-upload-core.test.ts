import test from "node:test";
import assert from "node:assert/strict";

import { detectApiMediaType } from "../../lib/api/media-upload-core.ts";

const bytes = (...values: number[]) => new Uint8Array(values);

test("detects PNG bytes even when the multipart header incorrectly says JPEG", () => {
  assert.equal(
    detectApiMediaType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a), "slide.png", "image/jpeg"),
    "image/png",
  );
});

test("detects JPEG, GIF, WebP, BMP, TIFF and PDF signatures", () => {
  assert.equal(detectApiMediaType(bytes(0xff, 0xd8, 0xff, 0x00), "photo.jpg", "image/png"), "image/jpeg");
  assert.equal(detectApiMediaType(bytes(0x47, 0x49, 0x46, 0x38, 0x39, 0x61), "animation.gif"), "image/gif");
  assert.equal(detectApiMediaType(bytes(0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50), "image.webp"), "image/webp");
  assert.equal(detectApiMediaType(bytes(0x42, 0x4d, 0, 0), "image.bmp"), "image/bmp");
  assert.equal(detectApiMediaType(bytes(0x49, 0x49, 0x2a, 0x00), "image.tiff"), "image/tiff");
  assert.equal(detectApiMediaType(bytes(0x25, 0x50, 0x44, 0x46, 0x2d), "document.pdf", "application/octet-stream"), "application/pdf");
});

test("detects AVIF, MP4 and QuickTime ISO-BMFF brands", () => {
  const ftyp = (brand: string) => bytes(
    0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70,
    ...Array.from(brand).map((character) => character.charCodeAt(0)),
    0, 0, 0, 0, 0, 0, 0, 0,
  );
  assert.equal(detectApiMediaType(ftyp("avif"), "image.avif"), "image/avif");
  assert.equal(detectApiMediaType(ftyp("isom"), "clip.mp4"), "video/mp4");
  assert.equal(detectApiMediaType(ftyp("qt  "), "clip.mov"), "video/quicktime");
});

test("distinguishes WebM and Matroska using filename or supported declared MIME", () => {
  const ebml = bytes(0x1a, 0x45, 0xdf, 0xa3, 0x00);
  assert.equal(detectApiMediaType(ebml, "clip.webm", "video/x-matroska"), "video/x-matroska");
  assert.equal(detectApiMediaType(ebml, "clip.mkv", "video/webm"), "video/x-matroska");
  assert.equal(detectApiMediaType(ebml, "clip.webm"), "video/webm");
});

test("rejects unknown bytes instead of trusting a misleading supported MIME header", () => {
  assert.equal(detectApiMediaType(bytes(0x00, 0x01, 0x02), "unknown.bin", "image/png"), null);
});
