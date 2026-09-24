import test from "node:test";
import assert from "node:assert/strict";
import { upsertDocumentEntryInCase } from "./caseDomain.js";
import { buildTrackingRecordText, DEFAULT_TRACKING_RECORD_TABLE_TEXT } from "./trackingRecordFormat.js";
import { isTrackingRecord, parseTrackingRecord } from "../components/caseDetail/trackingRecordHelpers.js";

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

test("a newly generated tracking record uses the shared valid empty table and survives the document save boundary", () => {
  const textContent = buildTrackingRecordText({
    metaType: "payment_tracker",
    purpose: "Rent payments",
    period: "January 2026",
    status: "open",
    summary: "Awaiting bank-statement review",
  });
  const updatedCase = upsertDocumentEntryInCase({ id: "case-1", documents: [] }, {
    id: "record-1",
    title: "Rent tracker",
    textContent,
  });
  const savedDocument = updatedCase.documents[0];
  const parsed = parseTrackingRecord(savedDocument);

  assert.equal(isTrackingRecord(savedDocument), true);
  assert.match(savedDocument.textContent, /\[TRACK RECORD\]/);
  assert.match(savedDocument.textContent, new RegExp(escapeRegex(DEFAULT_TRACKING_RECORD_TABLE_TEXT)));
  assert.equal(parsed.meta.type, "payment_tracker");
  assert.equal(parsed.meta.subject, "Rent payments");
  assert.equal(parsed.meta.period, "January 2026");
  assert.equal(parsed.meta.status, "open");
  assert.equal(parsed.summary, "Awaiting bank-statement review");
  assert.deepEqual(parsed.table, []);
});

test("existing custom tracking tables remain unchanged when their document is updated", () => {
  const customTable = "| Month | Hours | Comment |\n|-------|-------|---------|\n| Jan | 12 | Review |";
  const existing = {
    id: "case-1",
    documents: [{
      id: "record-1",
      title: "Custom tracker",
      textContent: buildTrackingRecordText({ metaType: "work_time", tableText: customTable }),
    }],
  };
  const updated = upsertDocumentEntryInCase(existing, {
    id: "record-1",
    title: "Renamed custom tracker",
    textContent: existing.documents[0].textContent,
  }, "record-1");
  const parsed = parseTrackingRecord(updated.documents[0]);

  assert.match(updated.documents[0].textContent, new RegExp(escapeRegex(customTable)));
  assert.deepEqual(parsed.table, [{ Month: "Jan", Hours: "12", Comment: "Review" }]);
});
