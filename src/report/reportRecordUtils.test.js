import assert from "node:assert/strict";
import test from "node:test";

import {
  compareReportChronology,
  getReportRecordDate,
  getReportRecordTitle,
  normaliseReportDate,
  projectAttachmentMetadata,
  projectReportRecord,
} from "./reportRecordUtils.js";

test("report titles use one deterministic fallback policy", () => {
  assert.equal(getReportRecordTitle({ title: "  Event  " }, "incident"), "Event");
  assert.equal(getReportRecordTitle({ label: "Payment" }, "ledger"), "Payment");
  assert.equal(getReportRecordTitle({}, "evidence"), "Untitled evidence");
});

test("report dates distinguish valid malformed and missing values", () => {
  assert.deepEqual(normaliseReportDate("2026-02-28"), { value: "2026-02-28", status: "valid", sortValue: "2026-02-28" });
  assert.equal(normaliseReportDate("2026-02-31").status, "malformed");
  assert.equal(normaliseReportDate("not-a-date").status, "malformed");
  assert.equal(normaliseReportDate(42).status, "missing");
  assert.equal(getReportRecordDate({ documentDate: "2026-03-01" }, "document").value, "2026-03-01");
});

test("canonical record projection retains facts and excludes attachment binaries", () => {
  const record = projectReportRecord({
    id: "ev-1",
    title: "Photo",
    date: "bad date",
    status: "archived",
    sequenceGroup: "Issue: A",
    linkedPartyIds: ["p1", "p1"],
    linkedIncidentIds: ["i1"],
    functionSummary: "Shows damage",
    attachments: [{ id: "a1", name: "photo.jpg", type: "image/jpeg", size: 12, dataUrl: "data:image/jpeg;base64,abc", blob: { bytes: [1] } }],
  }, "evidence", { sourceIndex: 3 });

  assert.equal(record.dateStatus, "malformed");
  assert.equal(record.archived, true);
  assert.deepEqual(record.partyIds, ["p1"]);
  assert.deepEqual(record.linkedRecordIds, ["i1"]);
  assert.deepEqual(record.attachmentMetadata, [{ id: "a1", filename: "photo.jpg", mimeType: "image/jpeg", sizeBytes: 12, source: "", createdAt: "" }]);
  assert.equal(JSON.stringify(record).includes("base64"), false);
  assert.equal(JSON.stringify(record).includes("blob"), false);
});

test("attachment projection accepts safe metadata only", () => {
  assert.deepEqual(projectAttachmentMetadata({ filename: "x.pdf", mimeType: "application/pdf", sizeBytes: 10, backupDataUrl: "data:x" }), {
    id: "", filename: "x.pdf", mimeType: "application/pdf", sizeBytes: 10, source: "", createdAt: "",
  });
  assert.equal(projectAttachmentMetadata({ dataUrl: "data:x" }), null);
});

test("chronology orders valid dates first with deterministic ties and undated values last", () => {
  const entries = [
    { id: "z", type: "watch", title: "Z", canonicalDate: "", dateStatus: "missing", sourceIndex: 0 },
    { id: "b", type: "evidence", title: "B", canonicalDate: "2026-01-01", dateStatus: "valid", sourceIndex: 0 },
    { id: "a", type: "incident", title: "A", canonicalDate: "2026-01-01", dateStatus: "valid", sourceIndex: 0 },
    { id: "m", type: "document", title: "Malformed", canonicalDate: "bad", dateStatus: "malformed", sourceIndex: 0 },
  ];
  assert.deepEqual([...entries].sort(compareReportChronology).map((item) => item.id), ["a", "b", "m", "z"]);
});
