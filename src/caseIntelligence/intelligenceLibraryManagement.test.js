import assert from "node:assert/strict";
import test from "node:test";
import { buildCaseIntelligenceContext } from "./contextInspector.js";
import { buildManualIntelligenceItemCandidate } from "./intelligenceLibraryManagement.js";
import { validateIntelligenceLibraryIntegrity } from "./intelligenceLibrary.js";

const TIME = "2026-11-06T14:00:00.000Z";
function fixture() {
  return {
    id: "case-1", revision: 3, name: "Synthetic case", updatedAt: TIME,
    issues: [{ id: "issue-1", reference: "ISS-001", name: "Synthetic Issue", status: "open" }],
    retiredIssues: [], parties: [{ id: "party-1", name: "Synthetic person" }], documents: [], ledger: [], tasks: [], strategy: [], watchItems: [], goals: [],
    incidents: [{ id: "incident-1", title: "Recorded incident", sequenceGroupId: "issue-1", linkedEvidenceIds: ["evidence-1"] }],
    evidence: [{ id: "evidence-1", title: "Linked evidence", sequenceGroupId: "issue-1", linkedIncidentIds: ["incident-1"] }],
  };
}
function ids() { const values = ["item-1", "revision-1", "item-2", "revision-2"]; return () => values.shift(); }

test("creates an immutable user-authored item from an allowlisted canonical context", async () => {
  const caseItem = fixture(); const before = structuredClone(caseItem);
  const context = buildCaseIntelligenceContext(caseItem, { scope: "issue", issueId: "issue-1" });
  const result = await buildManualIntelligenceItemCandidate({ caseItem, context, type: "hypothesis", statement: "Recorded uncertainty remains.", rationale: "The records conflict.", author: "Synthetic Reviewer", citationKeys: ["incident:incident-1", "evidence:evidence-1"], createdAt: TIME, idFactory: ids() });
  assert.equal(result.item.status, "under_review");
  assert.equal(result.revision.author.kind, "user");
  assert.equal(result.revision.source.scope.issueId, "issue-1");
  assert.equal(result.revision.source.scope.label, "ISS-001 — Synthetic Issue");
  assert.deepEqual(result.revision.citations.map((citation) => citation.recordId), ["evidence-1", "incident-1"]);
  assert.deepEqual(result.revision.citations.map((citation) => citation.issueId), ["issue-1", "issue-1"]);
  assert.equal((await validateIntelligenceLibraryIntegrity(result.intelligenceLibrary, { caseId: "case-1" })).valid, true);
  assert.deepEqual(caseItem, before);
});

test("fails closed for invalid scope, foreign contexts, unavailable citations, duplicates, and malformed libraries", async () => {
  const caseItem = fixture(); const context = buildCaseIntelligenceContext(caseItem, { scope: "issue", issueId: "issue-1" });
  await assert.rejects(buildManualIntelligenceItemCandidate({ caseItem, context: buildCaseIntelligenceContext(caseItem, { scope: "issue", issueId: "missing" }), type: "risk", statement: "x", author: "Reviewer", createdAt: TIME, idFactory: ids() }), /scope is unavailable or invalid/i);
  await assert.rejects(buildManualIntelligenceItemCandidate({ caseItem, context: { ...context, source: { ...context.source, caseId: "other" } }, type: "risk", statement: "x", author: "Reviewer", createdAt: TIME, idFactory: ids() }), /different case/i);
  await assert.rejects(buildManualIntelligenceItemCandidate({ caseItem, context, type: "risk", statement: "x", author: "Reviewer", citationKeys: ["document:missing"], createdAt: TIME, idFactory: ids() }), /no longer available/i);
  const created = await buildManualIntelligenceItemCandidate({ caseItem, context, type: "risk", statement: "x", author: "Reviewer", createdAt: TIME, idFactory: ids() });
  await assert.rejects(buildManualIntelligenceItemCandidate({ caseItem: { ...caseItem, intelligenceLibrary: created.intelligenceLibrary }, context, type: "risk", statement: "x", author: "Other", createdAt: TIME, idFactory: ids() }), /identical/i);
  await assert.rejects(buildManualIntelligenceItemCandidate({ caseItem: { ...caseItem, intelligenceLibrary: { schemaVersion: 1 } }, context, type: "risk", statement: "x", author: "Reviewer", createdAt: TIME, idFactory: ids() }), /Existing Intelligence Library is not valid/i);
});

test("preserves earlier immutable items and rejects duplicate identities without storage or network calls", async () => {
  const caseItem = fixture(); const context = buildCaseIntelligenceContext(caseItem);
  const first = await buildManualIntelligenceItemCandidate({ caseItem, context, type: "evidence_gap", statement: "First", author: "Reviewer", citationKeys: ["party:party-1"], createdAt: TIME, idFactory: ids() });
  const before = structuredClone(first.intelligenceLibrary);
  const originalFetch = globalThis.fetch; globalThis.fetch = () => { throw new Error("network must not be called"); };
  try {
    const nextIds = ["item-2", "revision-2"];
    const second = await buildManualIntelligenceItemCandidate({ caseItem: { ...caseItem, intelligenceLibrary: first.intelligenceLibrary }, context, type: "open_question", statement: "Second", author: "Reviewer", createdAt: "2026-11-06T15:00:00.000Z", idFactory: () => nextIds.shift() });
    assert.deepEqual(first.intelligenceLibrary, before);
    assert.equal(Object.keys(second.intelligenceLibrary.intelligenceItems).length, 2);
    assert.equal(Object.hasOwn(second.intelligenceLibrary.intelligenceItemRevisions["revision-1"].citations[0], "issueId"), false);
  } finally { globalThis.fetch = originalFetch; }
});
