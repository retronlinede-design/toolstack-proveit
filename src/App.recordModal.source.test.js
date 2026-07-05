import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("src/App.jsx", "utf8");

test("record mode initializes and saves documents with a valid tracking record marker", () => {
  assert.match(source, /function hasTrackingRecordMarker/);
  assert.match(source, /if \(!hasTrackingRecordMarker\(nextForm\.textContent\)\)/);
  assert.match(source, /nextForm\.textContent = buildTrackingRecordText/);
  assert.match(source, /const documentInput = documentModalMode === "record"/);
  assert.match(source, /ensureRecordDocumentForm\(documentForm\)/);
  assert.match(source, /Repairing tracking record textContent before save/);
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

test("record modal exposes the cleaned section layout and labels", () => {
  assert.match(source, /Record Basics/);
  assert.match(source, /Tracking Table/);
  assert.match(source, /Links/);
  assert.match(source, /Notes \/ Interpretation/);
  assert.match(source, /Advanced \/ Metadata/);
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
