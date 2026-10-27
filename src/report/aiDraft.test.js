import assert from "node:assert/strict";
import test from "node:test";
import { buildAiBrief } from "./aiBrief.js";
import { AI_DRAFT_MAX_BYTES, AI_DRAFT_SCHEMA_ID, AI_DRAFT_SCHEMA_VERSION, parseAiDraft, parseAndValidateAiDraft, validateAiDraft } from "./aiDraft.js";

function source() {
  return {
    id: "case-ai-draft", name: "Synthetic reporting case", updatedAt: "2026-10-27T10:00:00.000Z",
    issues: [{ id: "issue-a", reference: "ISS-001", name: "Primary", status: "open" }, { id: "issue-b", reference: "ISS-002", name: "Linked", status: "open" }],
    incidents: [{ id: "incident-a", title: "Recorded incident", eventDate: "2026-01-01", sequenceGroupId: "issue-a", sequenceGroup: "Primary", linkedEvidenceIds: ["evidence-b"] }],
    evidence: [{ id: "evidence-b", title: "Linked evidence", date: "2026-01-02", sequenceGroupId: "issue-b", sequenceGroup: "Linked", verificationStatus: "verified" }],
    documents: [], ledger: [], strategy: [], watchItems: [],
  };
}

function brief(family = "investigation", scope = "sequenceGroup") {
  return buildAiBrief(source(), { reportFamily: family, scope, issueId: scope === "sequenceGroup" ? "issue-a" : "", generatedAt: "2026-10-27T12:00:00.000Z" });
}

function reference(item, technicalSourceId) {
  return { recordType: item.recordType, recordId: item.recordId, scopeRelation: item.scopeRelation, technicalSourceId, issueId: item.issue.issueId || null };
}

function draftFor(aiBrief, { classification = "recorded_fact", references, overrides = {} } = {}) {
  const direct = aiBrief.recordReferences.find((item) => item.recordId === "incident-a");
  const sourceReferences = references || [reference(direct, "incidentSchedule")];
  return {
    schema: { id: AI_DRAFT_SCHEMA_ID, version: AI_DRAFT_SCHEMA_VERSION },
    reportFamily: aiBrief.requestedReportFamily,
    case: { id: aiBrief.case.id },
    scope: aiBrief.scope.type === "issue" ? { type: "issue", issueId: aiBrief.scope.issueId } : { type: "case" },
    sourceAiBrief: { sourceFingerprint: aiBrief.source.sourceFingerprint, caseRevision: aiBrief.source.caseRevision },
    sections: [{ id: "overview", heading: "Overview", narrative: "AI-generated narrative for human review.", claimIds: ["claim-1"] }],
    claims: [{ id: "claim-1", classification, text: "A source-recorded matter is described for review.", sourceReferences }],
    unresolvedQuestions: [], evidenceGaps: [], recommendations: [],
    ...overrides,
  };
}

function codes(result) { return result.errors.map((entry) => entry.code); }

test("validates Executive, Management, Investigation, and Client Update drafts bound to their exact AI Brief", () => {
  for (const [family, scope] of [["executive", "sequenceGroup"], ["management", "case"], ["investigation", "sequenceGroup"], ["client", "case"]]) {
    const aiBrief = brief(family, scope);
    const result = validateAiDraft(draftFor(aiBrief), aiBrief);
    assert.equal(result.valid, true, family);
    assert.equal(result.humanReviewRequired, true);
    assert.match(result.reviewReasons.join(" "), /human review/i);
  }
});

test("rejects wrong case, report family, canonical scope, fingerprint, and revision bindings", () => {
  const aiBrief = brief();
  for (const [field, value, code] of [
    ["case", { id: "other-case" }, "CASE_MISMATCH"],
    ["reportFamily", "executive", "REPORT_FAMILY_MISMATCH"],
    ["scope", { type: "issue", issueId: "issue-b" }, "SCOPE_MISMATCH"],
    ["sourceAiBrief", { sourceFingerprint: "wrong", caseRevision: aiBrief.source.caseRevision }, "FINGERPRINT_MISMATCH"],
    ["sourceAiBrief", { sourceFingerprint: aiBrief.source.sourceFingerprint, caseRevision: "wrong" }, "REVISION_MISMATCH"],
  ]) {
    const result = validateAiDraft(draftFor(aiBrief, { overrides: { [field]: value } }), aiBrief);
    assert.equal(codes(result).includes(code), true, code);
  }
});

test("accepts direct and linked-context references only when their exact Issue and technical-source context match", () => {
  const aiBrief = brief();
  const linked = aiBrief.recordReferences.find((item) => item.recordId === "evidence-b");
  const valid = validateAiDraft(draftFor(aiBrief, { classification: "interpretation", references: [reference(linked, "evidence")] }), aiBrief);
  assert.equal(valid.valid, true);
  assert.equal(valid.normalisedDraft.claims[0].sourceReferences[0].scopeRelation, "linked_context");
  const wrongRelation = { ...reference(linked, "evidence"), scopeRelation: "direct" };
  const wrongIssue = { ...reference(linked, "evidence"), issueId: "issue-a" };
  const excludedSource = { ...reference(aiBrief.recordReferences.find((item) => item.recordId === "incident-a"), "incidentSchedule"), technicalSourceId: "document" };
  for (const [candidate, code] of [[wrongRelation, "SCOPE_RELATION_MISMATCH"], [wrongIssue, "ISSUE_ASSOCIATION_MISMATCH"], [excludedSource, "EXCLUDED_TECHNICAL_SOURCE"]]) assert.equal(codes(validateAiDraft(draftFor(aiBrief, { references: [candidate] }), aiBrief)).includes(code), true, code);
});

test("rejects unknown references and de-duplicates repeated valid attribution without mutating inputs", () => {
  const aiBrief = brief();
  const originalDraft = draftFor(aiBrief);
  const beforeDraft = structuredClone(originalDraft);
  const beforeBrief = structuredClone(aiBrief);
  const duplicate = structuredClone(originalDraft);
  duplicate.claims[0].sourceReferences.push(structuredClone(duplicate.claims[0].sourceReferences[0]));
  const duplicateResult = validateAiDraft(duplicate, aiBrief);
  assert.equal(duplicateResult.valid, true);
  assert.equal(duplicateResult.warnings.some((entry) => entry.code === "DUPLICATE_REFERENCE_IGNORED"), true);
  assert.equal(duplicateResult.normalisedDraft.claims[0].sourceReferences.length, 1);
  const unknown = draftFor(aiBrief, { references: [{ recordType: "document", recordId: "missing", scopeRelation: "direct", technicalSourceId: "document", issueId: "issue-a" }] });
  assert.equal(codes(validateAiDraft(unknown, aiBrief)).includes("UNKNOWN_SOURCE_REFERENCE"), true);
  assert.deepEqual(originalDraft, beforeDraft);
  assert.deepEqual(aiBrief, beforeBrief);
});

test("requires classifications and source references while keeping allegations and interpretations subject to human review", () => {
  const aiBrief = brief();
  const missing = draftFor(aiBrief, { overrides: { claims: [{ id: "claim-1", text: "Missing classification.", sourceReferences: [] }] } });
  assert.equal(codes(validateAiDraft(missing, aiBrief)).includes("UNSUPPORTED_CLAIM_CLASSIFICATION"), true);
  const unsupported = draftFor(aiBrief, { overrides: { claims: [{ id: "claim-1", classification: "verified_truth", text: "Unsupported.", sourceReferences: [] }] } });
  assert.equal(codes(validateAiDraft(unsupported, aiBrief)).includes("UNSUPPORTED_CLAIM_CLASSIFICATION"), true);
  const allegation = validateAiDraft(draftFor(aiBrief, { classification: "allegation" }), aiBrief);
  assert.equal(allegation.valid, true);
  assert.equal(allegation.reviewReasons.some((reason) => /allegation/i.test(reason)), true);
  assert.equal(allegation.errors.some((entry) => entry.code === "VERIFIED"), false);
  const noSourceFact = validateAiDraft(draftFor(aiBrief, { references: [] }), aiBrief);
  assert.equal(codes(noSourceFact).includes("SOURCE_REFERENCE_REQUIRED"), true);
});

test("validates explicit unresolved questions, evidence gaps, and recommendations against the brief", () => {
  const aiBrief = brief();
  const direct = aiBrief.recordReferences.find((item) => item.recordId === "incident-a");
  const result = validateAiDraft(draftFor(aiBrief, { overrides: {
    unresolvedQuestions: [{ id: "question-1", text: "What further information is needed?", sourceReferences: [reference(direct, "incidentSchedule")] }],
    evidenceGaps: [{ id: "gap-1", text: "No additional source is recorded.", sourceReferences: [] }],
    recommendations: [{ id: "recommendation-1", text: "Seek human review before acting.", sourceReferences: [reference(direct, "incidentSchedule")] }],
  } }), aiBrief);
  assert.equal(result.valid, true);
  assert.equal(result.reviewReasons.some((reason) => /unresolved questions/i.test(reason)), true);
  assert.equal(result.reviewReasons.some((reason) => /recommendations/i.test(reason)), true);
});

test("parses bounded JSON and rejects unsupported schemas, malformed payloads, binary fields, and executable content", () => {
  const aiBrief = brief();
  const validText = JSON.stringify(draftFor(aiBrief));
  assert.equal(parseAndValidateAiDraft(validText, aiBrief).valid, true);
  assert.equal(parseAiDraft("not-json").errors[0].code, "MALFORMED_JSON");
  assert.equal(parseAiDraft("x".repeat(AI_DRAFT_MAX_BYTES + 1)).errors[0].code, "PAYLOAD_TOO_LARGE");
  const badSchema = draftFor(aiBrief, { overrides: { schema: { id: AI_DRAFT_SCHEMA_ID, version: 99 } } });
  assert.equal(codes(validateAiDraft(badSchema, aiBrief)).includes("UNSUPPORTED_SCHEMA"), true);
  const unsafe = draftFor(aiBrief, { overrides: { recommendations: [{ id: "unsafe", text: "data:text/plain,not-allowed", sourceReferences: [] }] } });
  assert.equal(codes(validateAiDraft(unsafe, aiBrief)).includes("DATA_URL"), true);
  const executable = JSON.stringify({ ...draftFor(aiBrief), recommendations: [{ id: "unsafe", text: "<script>alert(1)</script>", sourceReferences: [] }] });
  assert.equal(parseAiDraft(executable).errors.some((entry) => entry.code === "EXECUTABLE_CONTENT"), true);
});

test("returns deterministic validation results for equivalent draft and brief inputs", () => {
  const aiBrief = brief();
  const draft = draftFor(aiBrief);
  assert.deepEqual(validateAiDraft(draft, aiBrief), validateAiDraft(structuredClone(draft), structuredClone(aiBrief)));
});
