import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("src/components/caseDetail/RecordsTab.jsx", "utf8");

test("Records tab renders a compact selectable record list and one selected-record workspace", () => {
  assert.match(source, /lg:grid-cols-\[minmax\(15rem,0\.8fr\)_minmax\(0,2fr\)\]/);
  assert.match(source, /Tracking Records/);
  assert.match(source, /aria-pressed=\{isSelected\}/);
  assert.match(source, /setRequestedSelectedRecordId\(record\.id\)/);
  assert.match(source, /resolveSelectedTrackingRecordId\(trackingRecords, requestedSelectedRecordId\)/);
  assert.match(source, /<RecordTable record=\{selectedRecord\} structuredTable=\{structuredTable\} onEditRow=/);
  assert.doesNotMatch(source, /TRACKING_RECORD_PREVIEW_ROW_COUNT/);
  assert.doesNotMatch(source, /Show more/);
});

test("Records tab keeps selected-record actions and GPT exports wired to existing callbacks", () => {
  assert.match(source, /onClick=\{\(\) => onOpenRecord\(selectedRecord\)\}/);
  assert.match(source, /onClick=\{\(\) => onConvertRecord\?\.\(selectedRecord\)\}/);
  assert.match(source, /onClick=\{\(\) => onDeleteRecord\(selectedRecord\)\}/);
  assert.match(source, /onClick=\{\(\) => onViewPayments\(selectedRecord\)\}/);
  assert.match(source, /handleCopyRecordGptData\(selectedRecord/);
  assert.match(source, /handleCopyAllRecordsGptData/);
  assert.match(source, /Copy Record GPT JSON/);
  assert.match(source, /Copy All Records GPT JSON/);
});

test("Records tab has a clear empty state and preserves the add-record action", () => {
  assert.match(source, /trackingRecords\.length === 0/);
  assert.match(source, /No Case Records yet/);
  assert.match(source, /onClick=\{onAddRecord\}/);
  assert.match(source, /No rows yet\. Add an entry to begin tracking data\./);
});
test("Records tab offers structured Add and Edit Entry only for tables accepted by the editing-safe helper", () => {
  assert.match(source, /parseTrackingRecordTable\(getTrackingRecordTableText\(selectedRecord\.rawDocument\?\.textContent \|\| ""\)\)/);
  assert.match(source, /structuredTable\?\.status === "ok"/);
  assert.match(source, /Add Entry/);
  assert.match(source, /Edit Entry/);
  assert.match(source, /entryEditor\.headers\.map/);
  assert.match(source, /serializeTrackingRecordTable\(\{ headers: structuredTable\.headers, rows \}\)/);
  assert.match(source, /onSaveTrackingRecordTable\?\.\(selectedRecord\.rawDocument\.id, tableText\)/);
  assert.match(source, /Structured editing is unavailable for this legacy\/custom table\. Use Edit → Advanced \/ Raw Tracking Table\./);
  assert.doesNotMatch(source, />Delete Entry</);
  assert.doesNotMatch(source, /Reorder/);
});
test("Records tab confirms structured row deletion and keeps unsafe tables on the raw fallback", () => {
  assert.match(source, /onDeleteRow=\{deleteEntry\}/);
  assert.match(source, />Delete<\/button>/);
  assert.match(source, /window\.confirm\(`Delete this entry\?/);
  assert.match(source, /if \(!window\.confirm\(`Delete this entry\?/);
  assert.match(source, /removeTrackingRecordTableRow\(structuredTable, rowIndex\)/);
  assert.match(source, /serializeTrackingRecordTable\(remaining\)/);
  assert.match(source, /structuredTable\?\.status !== "ok"/);
  assert.match(source, /setEntryEditor\(null\)/);
  assert.doesNotMatch(source, /Reorder/);
  assert.doesNotMatch(source, /stable row ID/i);
});