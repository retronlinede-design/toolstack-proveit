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
  assert.match(source, /<RecordTable record=\{selectedRecord\} \/>/);
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
  assert.match(source, /No rows yet\. Open this record to add its table data\./);
});