import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("src/components/caseDetail/RecordsTab.jsx", "utf8");
const modalSource = readFileSync("src/components/caseDetail/ActiveLedgerRecordModal.jsx", "utf8");

test("Records tab renders a scoped, searchable selectable record workspace", () => {
  assert.match(source, /case-file-records/);
  assert.match(source, /lg:grid-cols-\[minmax\(16rem,\.85fr\)_minmax\(0,2fr\)\]/);
  assert.match(source, /Tracking Records/);
  assert.match(source, /case-record-search/);
  assert.match(source, /record\.title\?\.toLocaleLowerCase\(\)\.includes\(query\)/);
  assert.match(source, /aria-pressed=\{selected\}/);
  assert.match(source, /setRequestedSelectedRecordId\(record\.id\)/);
  assert.match(source, /resolveSelectedTrackingRecordId\(visibleRecords, requestedSelectedRecordId\)/);
  assert.match(source, /<RecordTable record=\{selectedRecord\} structuredTable=\{structuredTable\} onEditRow=/);
  assert.doesNotMatch(source, /TRACKING_RECORD_PREVIEW_ROW_COUNT/);
  assert.doesNotMatch(source, /Show more/);
});

test("Records tab preserves existing record actions, table editing, and GPT export callbacks", () => {
  assert.match(source, /onClick=\{\(\) => onOpenRecord\(selectedRecord\)\}/);
  assert.match(source, /onClick=\{\(\) => onConvertRecord\?\.\(selectedRecord\)\}/);
  assert.match(source, /onClick=\{\(\) => onDeleteRecord\(selectedRecord\)\}/);
  assert.match(source, /onClick=\{\(\) => onViewPayments\(selectedRecord\)\}/);
  assert.match(source, /buildTrackingRecordGptExport/);
  assert.match(source, /buildAllTrackingRecordsGptExport/);
  assert.match(source, /Derived payments/);
  assert.match(source, /Copy Record GPT JSON/);
  assert.match(source, /Copy All Records GPT JSON/);
  assert.match(source, /parseTrackingRecordTable\(getTrackingRecordTableText/);
  assert.match(source, /serializeTrackingRecordTable/);
  assert.match(source, /removeTrackingRecordTableRow/);
});

test("Records tab retains safe fallbacks and accessible row actions", () => {
  assert.match(source, /structuredTable\?\.status === "ok"/);
  assert.match(source, /Structured editing is unavailable for this legacy\/custom table/);
  assert.match(source, /aria-label=\{`Edit row \$\{rowIndex \+ 1\} in \$\{record\.title\}`\}/);
  assert.match(source, /aria-label=\{`Delete row \$\{rowIndex \+ 1\} in \$\{record\.title\}`\}/);
  assert.match(source, /window\.confirm\(`Delete this entry\?/);
  assert.doesNotMatch(source, /Reorder/);
  assert.doesNotMatch(source, /stable row ID/i);
});

test("Records tab uses canonical Issue labels and accessible editor feedback", () => {
  assert.match(source, /resolveCaseIssue\(caseItem/);
  assert.match(source, /getIssueDisplayLabel\(issue\)/);
  assert.match(source, /role="status" aria-live="polite"/);
  assert.match(source, /entryInputRef\.current\?\.focus\(\)/);
  assert.match(source, /event\.key === "Escape"/);
  assert.match(source, /restoreFocusRef\.current\?\.focus/);
});

test("derived payment preview clearly remains non-canonical and keyboard-dismissible", () => {
  assert.match(modalSource, /Derived Payment Preview/);
  assert.match(modalSource, /Not Canonical Ledger Entries/);
  assert.match(modalSource, /do not create or modify Ledger records/);
  assert.match(modalSource, /event\.key === "Escape"/);
  assert.match(modalSource, /aria-modal="true"/);
});
