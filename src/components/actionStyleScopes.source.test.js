import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const css = readFileSync(new URL("../index.css", import.meta.url), "utf8");
const manager = readFileSync(new URL("./sequenceGroups/SequenceGroupManager.jsx", import.meta.url), "utf8");
const recordModal = readFileSync(new URL("./RecordModal.jsx", import.meta.url), "utf8");
const watchWorkspace = readFileSync(new URL("./caseDetail/WatchWorkspace.jsx", import.meta.url), "utf8");
const watchCard = readFileSync(new URL("./caseDetail/WatchItemCard.jsx", import.meta.url), "utf8");

test("legacy Issue and record actions receive the shared teal, navy, and danger palette only in approved scopes", () => {
  assert.match(css, /Normalise legacy action utilities only inside the scoped case-management workspaces/);
  assert.match(css, /button:is\(\.border-lime-500, \.bg-lime-600\) \{\s+border-color: #0f766e;\s+background: #0f766e;/);
  assert.match(css, /button\.border-neutral-300\.bg-white \{\s+border-color: #475569;\s+background: #172554;/);
  assert.match(css, /button:is\(\.border-red-200, \.border-red-300\) \{\s+border-color: #7f1d1d;\s+background: #7f1d1d;/);
  assert.match(css, /background: #115e59;/);
  assert.match(css, /background: #1e3a5f;/);
  assert.match(css, /background: #991b1b;/);
});

test("Issue and Watch selection and focus treatments no longer use the legacy burgundy accent", () => {
  for (const source of [manager, watchWorkspace, readFileSync(new URL("./sequenceGroups/SequenceGroupForm.jsx", import.meta.url), "utf8"), readFileSync(new URL("./sequenceGroups/SequenceGroupDetailsForm.jsx", import.meta.url), "utf8"), readFileSync(new URL("./sequenceGroups/SequenceGroupDescription.jsx", import.meta.url), "utf8"), readFileSync(new URL("./sequenceGroups/SequenceGroupRecordManager.jsx", import.meta.url), "utf8")]) {
    assert.doesNotMatch(source, /#7a263a|#a94b63|#d17a91|#681f31/);
  }
  assert.match(manager, /border-\[#2dd4bf\].*bg-\[#0f3d4a\]/);
  assert.match(watchWorkspace, /focus-visible:ring-\[#2dd4bf\]/);
});

test("existing action and conversion callback wiring remains intact", () => {
  assert.match(manager, /onClick=\{\(\) => onMoveRecordToExisting\(record\)\}/);
  assert.match(manager, /onClick=\{\(\) => onClearRecord\(record\)\}/);
  assert.match(recordModal, /onClick=\{handleSubmitRecord\}/);
  assert.match(recordModal, /onClick=\{\(\) => onCreateEvidenceFromIncident\(recordForm\)\}/);
  assert.match(watchCard, /label: "Escalate to Incident", variant: "secondary", onClick: \(\) => onConvert\(item, "incidents"\)/);
  assert.match(watchCard, /label: "Convert to Strategy", variant: "secondary", onClick: \(\) => onConvert\(item, "strategy"\)/);
});
