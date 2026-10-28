import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";
import { transformWithOxc } from "vite";

const url = new URL("./AiBriefPanel.jsx", import.meta.url);
const transformed = await transformWithOxc(await readFile(url, "utf8"), url.pathname);
const code = transformed.code.replaceAll('from "react/jsx-runtime"', `from "${import.meta.resolve("react/jsx-runtime")}"`);
const { default: AiBriefPanel } = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);

const brief = {
  requestedReportFamily: "investigation",
  scope: { label: "ISS-001 — Synthetic Issue" },
  source: { caseRevision: "2026-10-26T10:00:00.000Z", sourceFingerprint: "fnv1a-test" },
  technicalSources: [{ id: "incidentSchedule", label: "Incident Schedule", included: true }, { id: "ledger", label: "Ledger Schedule", included: false }],
  recordReferences: [{ recordId: "inc-1" }],
  diagnostics: { unresolvedReferences: [{ targetId: "missing" }] },
};

test("renders the exact prepared package summary, request, draft-paste, and export controls", () => {
  const html = renderToStaticMarkup(React.createElement(AiBriefPanel, { brief, freshness: "current", feedback: "Prepared locally.", draftText: "{\"schema\":{}}", draftFeedback: "Draft text preserved.", onCopy() {}, onDownload() {}, onCopyDraftingRequest() {}, onDraftTextChange() {}, onValidateDraft() {} }));
  for (const text of ["AI Brief prepared", "ISS-001 — Synthetic Issue", "Source: Current", "Source revision", "Source fingerprint", "Incident Schedule", "Copy AI Brief JSON", "Download AI Brief JSON", "Copy Drafting Request", "Inspect AI Brief JSON", "Paste and validate AI Draft JSON", "Validate AI Draft", "Attachment binaries and data URLs are excluded", "Prepared locally.", "Draft text preserved."]) assert.match(html, new RegExp(text));
  assert.match(html, /role="status"/);
});

test("marks stale and unknown packages as requiring explicit regeneration without removing their exact export actions", () => {
  for (const freshness of ["stale", "unknown"]) {
    const html = renderToStaticMarkup(React.createElement(AiBriefPanel, { brief, freshness, onCopy() {}, onDownload() {} }));
    assert.match(html, new RegExp(`Source: ${freshness[0].toUpperCase()}${freshness.slice(1)}`));
    assert.match(html, /Regenerate it before treating it as current case context/);
    assert.match(html, /Copy AI Brief JSON/);
    assert.match(html, /Download AI Brief JSON/);
    assert.match(html, /Copy Drafting Request/);
    assert.match(html, /disabled=""/);
  }
});

test("shows structural status, reference errors, and human-review limits without treating a valid draft as approval", () => {
  const validation = { valid: true, errors: [], warnings: [{ code: "UNVERIFIED_SOURCE_REFERENCE", message: "Review the record." }], reviewReasons: ["AI-generated narrative must receive human review."], normalisedDraft: { claims: [{ classification: "allegation", sourceReferences: [{ recordId: "inc-1" }] }], unresolvedQuestions: [{ id: "question" }], evidenceGaps: [{ id: "gap" }] } };
  const html = renderToStaticMarkup(React.createElement(AiBriefPanel, { brief, freshness: "stale", draftText: "{}", draftValidation: validation, onCopy() {}, onDownload() {}, onCopyDraftingRequest() {}, onDraftTextChange() {}, onValidateDraft() {} }));
  for (const text of ["Structurally valid against the historical AI Brief", "not ready for approval", "Human-review warnings", "UNVERIFIED_SOURCE_REFERENCE", "Claim classifications", "allegation", "Unresolved questions:</strong> 1", "Evidence gaps:</strong> 1", "does not establish that narrative claims are true"]) assert.match(html, new RegExp(text));
});

test("offers the Management-only preview only after unchanged successful validation and labels it as local-only", () => {
  const managementBrief = { ...brief, requestedReportFamily: "management" };
  const validation = { valid: true, errors: [], warnings: [], reviewReasons: ["Human review required."], normalisedDraft: { claims: [], unresolvedQuestions: [], evidenceGaps: [] } };
  const available = renderToStaticMarkup(React.createElement(AiBriefPanel, { brief: managementBrief, freshness: "unknown", draftText: "{}", draftValidation: validation, managementPreviewAvailable: true, onPreviewManagementDraft() {}, onCopy() {}, onDownload() {}, onDraftTextChange() {}, onValidateDraft() {} }));
  assert.match(available, /Preview Management Draft/); assert.doesNotMatch(available, /Preview Management Draft[^>]*disabled=""/); assert.match(available, /not saved, approved, printed, or exported/);
  const executive = renderToStaticMarkup(React.createElement(AiBriefPanel, { brief, freshness: "current", draftText: "{}", draftValidation: validation, onCopy() {}, onDownload() {}, onDraftTextChange() {}, onValidateDraft() {} }));
  assert.doesNotMatch(executive, /Preview Management Draft/);
});
