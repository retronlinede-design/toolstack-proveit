import assert from "node:assert/strict";
import test from "node:test";
import {
  assessIntelligenceCitations,
  assessIntelligenceFreshness,
  assessIntelligenceProvenance,
} from "./intelligenceProvenance.js";
import { buildCaseIntelligenceContext } from "./contextInspector.js";

function fixture() {
  return {
    id: "case-1", revision: 7, name: "Synthetic Case", updatedAt: "2026-11-06T12:00:00.000Z",
    issues: [{ id: "issue-a", reference: "ISS-001", name: "Same", status: "open" }, { id: "issue-b", reference: "ISS-002", name: "Same", status: "open" }],
    retiredIssues: [{ id: "retired", reference: "ISS-003", name: "Retired" }],
    incidents: [{ id: "inc-a", title: "Direct incident", sequenceGroupId: "issue-a", linkedEvidenceIds: ["evidence-b"] }],
    evidence: [{ id: "evidence-b", title: "Linked evidence", sequenceGroupId: "issue-b", linkedIncidentIds: ["inc-a"], verificationStatus: "unverified" }],
    documents: [{ id: "doc-1", title: "Document", linkedRecordIds: ["inc-a"] }],
    parties: [], ledger: [], tasks: [], strategy: [], watchItems: [], goals: [],
  };
}

function entry(caseData = fixture()) {
  const context = buildCaseIntelligenceContext(caseData, { scope: "issue", issueId: "issue-a" });
  return {
    id: "message-1", caseId: caseData.id, source: { caseRevision: context.source.caseRevision, sourceFingerprint: context.source.sourceFingerprint, scope: { type: "issue", issueId: "issue-a" } },
    citations: [
      { recordType: "incident", recordId: "inc-a", scopeRelation: "direct", issueId: "issue-a", capturedLabel: "Historical direct incident" },
      { recordType: "evidence", recordId: "evidence-b", scopeRelation: "linked_context", issueId: "issue-b", capturedLabel: "Historical linked evidence" },
    ],
  };
}

test("assesses matching revision and fingerprint as current, and any change as stale", () => {
  const source = fixture();
  const stored = entry(source);
  assert.equal(assessIntelligenceFreshness(stored, source).state, "current");
  assert.equal(assessIntelligenceFreshness(stored, { ...source, revision: 8 }).state, "stale");
  const changed = structuredClone(source);
  changed.incidents[0].title = "Changed incident";
  assert.equal(assessIntelligenceFreshness(stored, changed).state, "stale");
});

test("fails closed to unknown for unavailable, invalid, retired, ambiguous, and unsupported source contexts", () => {
  const stored = entry();
  assert.equal(assessIntelligenceFreshness(stored, null).state, "unknown");
  assert.equal(assessIntelligenceFreshness({ ...stored, source: { ...stored.source, scope: { type: "issue", issueId: "retired" } } }, fixture()).state, "unknown");
  assert.equal(assessIntelligenceFreshness({ ...stored, source: { ...stored.source, scope: { type: "issue", issueName: "Same" } } }, fixture()).state, "unknown");
  assert.equal(assessIntelligenceFreshness(stored, fixture(), { sourceContract: { id: "proveit.case-intelligence-context", version: 2 } }).state, "unknown");
});

test("resolves direct and linked citations without rewriting captured labels or verification state", () => {
  const source = fixture();
  const stored = entry(source);
  const citations = assessIntelligenceCitations(stored, source);
  assert.deepEqual(citations.map((item) => [item.citation.recordId, item.status, item.current?.scopeRelation]), [["evidence-b", "available", "linked_context"], ["inc-a", "available", "direct"]]);
  assert.equal(citations.find((item) => item.citation.recordId === "inc-a").citation.capturedLabel, "Historical direct incident");
  assert.equal(source.evidence[0].verificationStatus, "unverified");
});

test("reports missing, unresolved, invalid, and cross-case citations separately", () => {
  const source = fixture();
  const stored = entry(source);
  stored.citations.push(
    { recordType: "document", recordId: "missing", scopeRelation: "direct", capturedLabel: "Historical missing" },
    { recordType: "document", recordId: "missing-unresolved", scopeRelation: "unresolved", capturedLabel: "Historical unresolved" },
    { recordType: "document", recordId: "doc-1", scopeRelation: "direct", caseId: "other-case", capturedLabel: "Cross case" },
  );
  const results = assessIntelligenceCitations(stored, source);
  assert.equal(results.find((item) => item.citation.recordId === "missing").status, "missing");
  assert.equal(results.find((item) => item.citation.recordId === "missing-unresolved").status, "unresolved");
  assert.equal(results.find((item) => item.citation.recordId === "doc-1").status, "cross_case");
});

test("provenance assessment is deterministic, input-immutable, and has no network or storage side effects", () => {
  const source = fixture();
  const stored = entry(source);
  const beforeSource = structuredClone(source);
  const beforeStored = structuredClone(stored);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = () => { throw new Error("network must not be called"); };
  try {
    const first = assessIntelligenceProvenance(stored, source);
    const second = assessIntelligenceProvenance(stored, source);
    assert.deepEqual(first, second);
    assert.equal(first.readOnly, true);
    assert.equal(first.localOnly, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.deepEqual(source, beforeSource);
  assert.deepEqual(stored, beforeStored);
});
