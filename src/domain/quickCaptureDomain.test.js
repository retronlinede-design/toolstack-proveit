import test from "node:test";
import assert from "node:assert/strict";

import {
  archiveQuickCapture,
  createQuickCaptureFromForm,
  markQuickCaptureConverted,
  normalizeQuickCapture,
} from "./quickCaptureDomain.js";

test("normalizeQuickCapture preserves current defaults without forcing attachments by default", () => {
  const normalized = normalizeQuickCapture({
    id: "capture-1",
    title: "Capture",
    status: "bad-status",
    createdAt: "2024-01-01T09:00:00.000Z",
  });

  assert.deepEqual(normalized, {
    id: "capture-1",
    title: "Capture",
    status: "unreviewed",
    createdAt: "2024-01-01T09:00:00.000Z",
    source: "manual",
    updatedAt: "2024-01-01T09:00:00.000Z",
    convertedTo: null,
  });
});

test("normalizeQuickCapture preserves import merge attachment normalization quirk when requested", () => {
  const normalized = normalizeQuickCapture({
    id: "capture-1",
    title: "Capture",
    status: "converted",
    convertedTo: "",
    attachments: "not-array",
  }, { normalizeAttachments: true });

  assert.equal(normalized.status, "converted");
  assert.equal(normalized.convertedTo, null);
  assert.deepEqual(normalized.attachments, []);
  assert.equal(normalized.source, "manual");
  assert.match(normalized.updatedAt, /^\d{4}-\d{2}-\d{2}T/);
});

test("createQuickCaptureFromForm builds the current quick-capture object shape", () => {
  const originalRandomUUID = crypto.randomUUID;
  crypto.randomUUID = () => "capture-generated";

  try {
    const capture = createQuickCaptureFromForm({
      title: "  New capture  ",
      date: "",
      note: "  Notes  ",
      attachments: [{ id: "att-1" }],
    }, {
      id: "case-1",
      name: "Case name",
    });

    assert.equal(capture.id, "capture-generated");
    assert.equal(capture.caseId, "case-1");
    assert.equal(capture.caseName, "Case name");
    assert.equal(capture.title, "New capture");
    assert.match(capture.date, /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(capture.note, "Notes");
    assert.deepEqual(capture.attachments, [{ id: "att-1" }]);
    assert.equal(capture.status, "unreviewed");
    assert.equal(capture.convertedTo, null);
    assert.equal(capture.source, "manual");
    assert.match(capture.createdAt, /^\d{4}-\d{2}-\d{2}T/);
    assert.match(capture.updatedAt, /^\d{4}-\d{2}-\d{2}T/);
  } finally {
    crypto.randomUUID = originalRandomUUID;
  }
});

test("archiveQuickCapture preserves current archive mutation behavior", () => {
  const capture = {
    id: "capture-1",
    status: "unreviewed",
    convertedTo: null,
    title: "Capture",
  };

  const archived = archiveQuickCapture(capture);

  assert.equal(archived.id, "capture-1");
  assert.equal(archived.title, "Capture");
  assert.equal(archived.status, "archived");
  assert.equal(archived.convertedTo, null);
  assert.match(archived.updatedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(capture.updatedAt, undefined);
});

test("markQuickCaptureConverted preserves current converted fields and targetType behavior", () => {
  const capture = {
    id: "capture-1",
    status: "unreviewed",
    convertedTo: null,
    title: "Capture",
  };

  const converted = markQuickCaptureConverted(capture, "evidence");

  assert.equal(converted.id, "capture-1");
  assert.equal(converted.title, "Capture");
  assert.equal(converted.status, "converted");
  assert.equal(converted.convertedTo, "evidence");
  assert.match(converted.updatedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(capture.updatedAt, undefined);
});
