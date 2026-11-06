import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const panel = readFileSync(new URL("./IntelligenceLibraryPanel.jsx", import.meta.url), "utf8");
const workspace = readFileSync(new URL("./AiWorkspaceTab.jsx", import.meta.url), "utf8");
const caseDetail = readFileSync(new URL("../CaseDetail.jsx", import.meta.url), "utf8");
const app = readFileSync(new URL("../../App.jsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../../index.css", import.meta.url), "utf8");

test("Case Intelligence Library is placed inside the Context Inspector workspace with local-only manual-note controls", () => {
  assert.match(workspace, /import IntelligenceLibraryPanel from "\.\/IntelligenceLibraryPanel"/);
  assert.match(workspace, /inspectorActive && <IntelligenceLibraryPanel/);
  assert.match(panel, /Local notes and reviewable working intelligence/);
  assert.match(panel, /Human-authored notes/);
  assert.match(panel, /data-intelligence-library-form/);
  assert.match(panel, /Explicit source citations \(optional\)/);
  assert.match(panel, /data-intelligence-library-create/);
  assert.match(styles, /\[data-intelligence-library\]/);
});

test("manual notes use the current context, controlled case update, and immutable provenance browser", () => {
  assert.match(caseDetail, /buildManualIntelligenceItemCandidate/);
  assert.match(caseDetail, /contextInspectorFreshness !== "current"/);
  assert.match(caseDetail, /intelligenceLibrary: candidate\.intelligenceLibrary/);
  assert.match(caseDetail, /allowIntelligenceLibraryWrite: true/);
  assert.match(caseDetail, /assessIntelligenceProvenance/);
  assert.match(panel, /Selected immutable revision/);
  assert.match(panel, /provenanceByRevision/);
  assert.match(app, /allowIntelligenceLibraryWrite: options\.allowIntelligenceLibraryWrite === true/);
});

test("the panel retains accessibility semantics for source selection, status feedback, and revision browsing", () => {
  assert.match(panel, /<form data-intelligence-library-form onSubmit=\{submit\}>/);
  assert.match(panel, /<fieldset disabled=\{!contextReady \|\| saving\}>/);
  assert.match(panel, /role="status" aria-live="polite"/);
  assert.match(panel, /role="list" data-intelligence-library-list/);
  assert.match(panel, /aria-pressed=\{selected\?\.item\.id === item\.id\}/);
});
