import test from "node:test";
import assert from "node:assert/strict";
import {
  getDataUrlMimeType,
  getFileSizeWarning,
  getPreviewMimeType,
  isAllowedPreviewImageMimeType,
  isAllowedPreviewMimeType,
} from "./fileSecurity.js";

test("getDataUrlMimeType reads MIME type from data URLs", () => {
  assert.equal(getDataUrlMimeType("data:image/png;base64,abc"), "image/png");
  assert.equal(getDataUrlMimeType("data:application/pdf;base64,abc"), "application/pdf");
  assert.equal(getDataUrlMimeType("not-a-data-url"), "");
});

test("preview MIME allow-list permits only supported images and PDFs", () => {
  assert.equal(isAllowedPreviewMimeType("image/png"), true);
  assert.equal(isAllowedPreviewMimeType("image/jpeg"), true);
  assert.equal(isAllowedPreviewMimeType("image/webp"), true);
  assert.equal(isAllowedPreviewMimeType("image/gif"), true);
  assert.equal(isAllowedPreviewMimeType("application/pdf"), true);
  assert.equal(isAllowedPreviewMimeType("image/svg+xml"), false);
  assert.equal(isAllowedPreviewMimeType("text/html"), false);
});

test("image preview allow-list excludes non-image and unsupported image types", () => {
  assert.equal(isAllowedPreviewImageMimeType("image/jpeg"), true);
  assert.equal(isAllowedPreviewImageMimeType("application/pdf"), false);
  assert.equal(isAllowedPreviewImageMimeType("image/svg+xml"), false);
});

test("getPreviewMimeType prefers data URL MIME over fallback type", () => {
  assert.equal(getPreviewMimeType("data:text/html;base64,abc", "image/png"), "text/html");
  assert.equal(getPreviewMimeType("", "image/png"), "image/png");
});

test("getFileSizeWarning warns without rejecting large files", () => {
  assert.equal(getFileSizeWarning({ name: "small.pdf", size: 1024 }), "");
  assert.match(getFileSizeWarning({ name: "medium.pdf", size: 11 * 1024 * 1024 }), />10MB|larger than 10MB/);
  assert.match(getFileSizeWarning({ name: "large.pdf", size: 26 * 1024 * 1024 }), />25MB|larger than 25MB/);
});
