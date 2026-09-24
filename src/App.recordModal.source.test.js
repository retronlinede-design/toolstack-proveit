import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("src/App.jsx", "utf8");

test("record mode initializes and saves documents with a valid tracking record marker", () => {
  assert.match(source, /function hasTrackingRecordMarker/);
  assert.match(source, /if \(!hasTrackingRecordMarker\(nextForm\.textContent\)\)/);
  assert.match(source, /nextForm\.textContent = buildTrackingRecordText/);
  assert.match(source, /import \{ buildTrackingRecordText, DEFAULT_TRACKING_RECORD_TABLE_TEXT, replaceTrackingRecordTableText \} from "\.\/domain\/trackingRecordFormat\.js"/);
  assert.match(source, /const documentInput = documentModalMode === "record"/);
  assert.match(source, /ensureRecordDocumentForm\(documentForm\)/);
  assert.match(source, /Repairing tracking record textContent before save/);
  assert.doesNotMatch(source, /\| Period\/Date \| Expected \| Actual \| Difference \| Unit \| Status \| Notes \|/);
});

test("record mode preserves tracking metadata sections when rebuilding textContent", () => {
  assert.match(source, /function getRecordPeriodText/);
  assert.match(source, /function getRecordStatusText/);
  assert.match(source, /function getRecordFileLinksText/);
  assert.match(source, /function getRecordNotesText/);
  assert.match(source, /period: getRecordPeriodText\(nextForm\)/);
  assert.match(source, /status: getRecordStatusText\(nextForm\)/);
  assert.match(source, /fileLinks: getRecordFileLinksText\(nextForm\)/);
  assert.match(source, /notes: getRecordNotesText\(nextForm\)/);
});

test("new record creation keeps table editing out of the normal workflow while existing records retain it as an advanced compatibility control", () => {
  assert.match(source, /Record Basics/);
  assert.match(source, /Links/);
  assert.match(source, /Notes \/ Interpretation/);
  assert.match(source, /Advanced \/ Metadata/);
  assert.match(source, /\{editingDocumentId && \(/);
  assert.match(source, /Raw Tracking Table/);
  assert.match(source, /updateRecordDocumentForm\(\{ tableText: e\.target\.value \}\)/);
  assert.doesNotMatch(source, /Copy Record Prompt/);
  assert.match(source, /Copy Legacy GPT Formatting Prompt/);
  assert.doesNotMatch(source, /Table \/ Structured Record Text/);
  assert.doesNotMatch(source, /Notes \/ Summary/);
});

test("normal document modal keeps document-specific fields unchanged", () => {
  assert.match(source, /Add Document/);
  assert.match(source, /Document Date/);
  assert.match(source, /Attach Document/);
  assert.match(source, /Linked Records/);
});

test("document modal loads and edits linked party ids", () => {
  assert.match(source, /linkedPartyIds: Array\.isArray\(preset\.linkedPartyIds\) \? preset\.linkedPartyIds : \[\]/);
  assert.match(source, /<LinkedPartiesSelector\s+parties=\{selectedCase\?\.parties \|\| \[\]\}\s+linkedPartyIds=\{documentForm\.linkedPartyIds\}/);
  assert.match(source, /onChange=\{\(linkedPartyIds\) => setDocumentForm\(\(prev\) => \(\{ \.\.\.prev, linkedPartyIds \}\)\)\}/);
});

test("ledger modal loads and edits linked party ids", () => {
  assert.match(source, /linkedPartyIds: Array\.isArray\(preset\.linkedPartyIds\) \? preset\.linkedPartyIds : \[\]/);
  assert.match(source, /linkedPartyIds: Array\.isArray\(duplicated\.linkedPartyIds\) \? duplicated\.linkedPartyIds : \[\]/);
  assert.match(source, /<LinkedPartiesSelector\s+parties=\{selectedCase\?\.parties \|\| \[\]\}\s+linkedPartyIds=\{ledgerForm\.linkedPartyIds\}/);
  assert.match(source, /onChange=\{\(linkedPartyIds\) => setLedgerForm\(\(prev\) => \(\{ \.\.\.prev, linkedPartyIds \}\)\)\}/);
});

test("record saves pass through the established canonical Issue normalization boundary", () => {
  assert.match(source, /updatedCase = upsertRecordInCase\(selectedCase, recordType, payloadForUpsert, currentEditingRecord\);\s+const issueResult = normalizeCaseIssues\(updatedCase, \{/);
  assert.match(source, /sequenceGroupMeta: getSequenceGroupMetaForCase\(updatedCase\.id, readSequenceGroupMetaStore\(\)\)/);
  assert.match(source, /updatedCase = issueResult\.caseData;/);
});
