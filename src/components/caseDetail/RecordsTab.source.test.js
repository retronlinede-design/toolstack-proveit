import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("src/components/caseDetail/RecordsTab.jsx", "utf8");

test("Records tab tracking record cards use per-record expandable table previews", () => {
  assert.match(source, /const TRACKING_RECORD_PREVIEW_ROW_COUNT = 5/);
  assert.match(source, /const \[expandedRecordIds, setExpandedRecordIds\] = useState\(\{\}\)/);
  assert.match(source, /function toggleRecordExpansion\(recordId\)/);
  assert.match(source, /\[recordId\]: !prev\[recordId\]/);
  assert.match(source, /const isExpanded = Boolean\(expandedRecordIds\[record\.id\]\)/);
  assert.match(source, /const hasHiddenRows = tableRows\.length > TRACKING_RECORD_PREVIEW_ROW_COUNT/);
  assert.match(source, /const visibleRows = hasHiddenRows && !isExpanded/);
  assert.match(source, /tableRows\.slice\(0, TRACKING_RECORD_PREVIEW_ROW_COUNT\)/);
});

test("Records tab shows expand control only for records with hidden rows", () => {
  assert.match(source, /\{hasHiddenRows && \(/);
  assert.match(source, /onClick=\{\(\) => toggleRecordExpansion\(record\.id\)\}/);
  assert.match(source, /aria-expanded=\{isExpanded\}/);
  assert.match(source, /\{isExpanded \? "Show less" : "Show more"\}/);
  assert.match(source, /Showing all \$\{tableRows\.length\} rows/);
  assert.match(source, /\$\{hiddenRowCount\} more row/);
});

test("Records tab keeps long row text readable inside table cells", () => {
  assert.match(source, /className=\{`break-words \$\{isDifference/);
  assert.match(source, /overflow-x-auto rounded-xl border/);
});

test("Records tab exposes GPT copy utilities for individual and all tracking records", () => {
  assert.match(source, /buildTrackingRecordGptExport/);
  assert.match(source, /buildAllTrackingRecordsGptExport/);
  assert.match(source, /function handleCopyRecordGptData/);
  assert.match(source, /function handleCopyAllRecordsGptData/);
  assert.match(source, /Copy GPT Data/);
  assert.match(source, /Copy All Records for GPT/);
});
