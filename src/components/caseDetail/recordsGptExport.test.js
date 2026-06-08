import test from "node:test";
import assert from "node:assert/strict";

import {
  buildAllTrackingRecordsGptExport,
  buildTrackingRecordGptExport,
} from "./recordsGptExport.js";

function buildRecord(id = "record-1") {
  return {
    id,
    title: "Rent ledger",
    meta: {
      type: "ledger",
      subject: "Rent payments",
      period: "2026",
      status: "active",
    },
    table: [
      { Date: "2026-01-01", Amount: "100", Status: "paid", Notes: "First row" },
      { Date: "2026-02-01", Amount: "100", Status: "missing", Notes: "Second row data:image/png;base64,bad" },
    ],
    summary: "Tracks rent payment records.",
    notes: "Check against bank records.",
    rawDocument: {
      id,
      title: "Rent ledger",
      category: "tracking",
      source: "tenant",
      sequenceGroup: "Rent Chain",
      documentDate: "2026-01-03",
      createdAt: "2026-01-04T10:00:00Z",
      updatedAt: "2026-01-05T10:00:00Z",
      textContent: "[TRACK RECORD]\nFull source text\n--- TABLE ---\nrow data",
      linkedRecordIds: ["doc-1"],
      basedOnEvidenceIds: ["ev-1"],
      attachments: [{ id: "att-1", dataUrl: "data:image/png;base64,bad" }],
      dataUrl: "data:image/png;base64,bad",
      backupDataUrl: "data:image/png;base64,backup",
      files: [{ id: "file-1", blob: "bad" }],
    },
  };
}

test("single tracking record GPT export includes full text and table rows without binary fields", () => {
  const payload = buildTrackingRecordGptExport(
    { id: "case-1", name: "Case Name", status: "open" },
    buildRecord(),
    {
      usedByIncidents: [{ id: "inc-1" }],
      basedOnEvidence: [{ id: "ev-2" }],
    }
  );
  const serialized = JSON.stringify(payload);

  assert.equal(payload.exportType, "GPT_RECORD_EXPORT");
  assert.equal(payload.importable, false);
  assert.equal(payload.includesBinaryData, false);
  assert.equal(payload.case.id, "case-1");
  assert.equal(payload.case.name, "Case Name");
  assert.equal(payload.record.id, "record-1");
  assert.equal(payload.record.recordType, "trackingRecord");
  assert.equal(payload.record.purpose, "Rent payments");
  assert.equal(payload.record.sequenceGroup, "Rent Chain");
  assert.match(payload.record.textContent, /Full source text/);
  assert.equal(payload.record.table.length, 2);
  assert.deepEqual(payload.record.linkedRecordIds, ["doc-1"]);
  assert.deepEqual(payload.record.linkedIncidentIds, ["inc-1"]);
  assert.deepEqual(payload.record.linkedEvidenceIds, ["ev-1", "ev-2"]);
  assert.doesNotMatch(serialized, /attachments/);
  assert.doesNotMatch(serialized, /data:image/);
  assert.doesNotMatch(serialized, /backupDataUrl/);
  assert.doesNotMatch(serialized, /blob/);
});

test("all tracking records GPT export includes all records in a safe envelope", () => {
  const records = [buildRecord("record-1"), buildRecord("record-2")];
  const payload = buildAllTrackingRecordsGptExport(
    { id: "case-1", name: "Case Name" },
    records,
    {
      "record-1": { usedByIncidents: [{ id: "inc-1" }] },
      "record-2": { basedOnEvidence: [{ id: "ev-2" }] },
    }
  );

  assert.equal(payload.exportType, "GPT_RECORDS_EXPORT");
  assert.equal(payload.importable, false);
  assert.equal(payload.includesBinaryData, false);
  assert.deepEqual(payload.records.map((record) => record.id), ["record-1", "record-2"]);
  assert.match(JSON.stringify(payload.instructions), /Do not invent facts/);
  assert.match(JSON.stringify(payload.instructions), /Do not generate ProveIt deltas/);
});
