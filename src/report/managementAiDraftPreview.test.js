import assert from "node:assert/strict";
import test from "node:test";
import { buildAiBrief } from "./aiBrief.js";
import { validateAiDraft } from "./aiDraft.js";
import { buildManagementAiDraftPreview, isManagementAiDraftPreview } from "./managementAiDraftPreview.js";

function caseItem() { return { id: "case-management-preview", name: "Preview Case", updatedAt: "2026-10-28T10:00:00.000Z", issues: [{ id: "issue-a", reference: "ISS-001", name: "Matter", status: "open" }], incidents: [{ id: "incident-a", title: "Recorded incident", sequenceGroupId: "issue-a", sequenceGroup: "Matter", verificationStatus: "recorded" }], evidence: [], documents: [], ledger: [], strategy: [], watchItems: [] }; }
function draftFor(brief, family = "management") { const reference = brief.recordReferences[0]; return { schema: { id: "proveit.ai-draft", version: 1 }, reportFamily: family, case: { id: brief.case.id }, scope: { type: "case" }, sourceAiBrief: { sourceFingerprint: brief.source.sourceFingerprint, caseRevision: brief.source.caseRevision }, sections: [{ id: "overview", heading: "Management Overview", narrative: "AI-authored narrative.", claimIds: ["fact", "interpretation"] }], claims: [{ id: "fact", classification: "recorded_fact", text: "A recorded incident exists.", sourceReferences: [{ recordType: reference.recordType, recordId: reference.recordId, scopeRelation: reference.scopeRelation, technicalSourceId: reference.sourceTechnicalReportIds[0], issueId: reference.issue.issueId }] }, { id: "interpretation", classification: "interpretation", text: "Management attention may be useful.", sourceReferences: [] }], unresolvedQuestions: [{ id: "question", text: "What response is recorded?", sourceReferences: [] }], evidenceGaps: [{ id: "gap", text: "Further evidence may be required.", sourceReferences: [] }], recommendations: [{ id: "action", text: "Review the recorded material.", sourceReferences: [] }] }; }

test("adapts a validated Management draft into a detached professional-preview model", () => {
  const brief = buildAiBrief(caseItem(), { reportFamily: "management", generatedAt: "2026-10-28T12:00:00.000Z" }); const draft = draftFor(brief); const validation = validateAiDraft(draft, brief); const before = structuredClone(draft);
  const preview = buildManagementAiDraftPreview({ draft, brief, validation, freshness: "stale" }); const repeated = buildManagementAiDraftPreview({ draft: before, brief, validation, freshness: "stale" });
  assert.equal(isManagementAiDraftPreview(preview), true); assert.equal(preview.aiDraftPreview.freshness, "stale"); assert.equal(preview.source.caseId, brief.case.id);
  assert.equal(preview.aiDraftPreview.sections[0].claims[0].classification, "recorded_fact"); assert.equal(preview.aiDraftPreview.sections[0].claims[0].sourceReferences[0].recordId, "incident-a"); assert.equal(preview.aiDraftPreview.unresolvedQuestions[0].text, "What response is recorded?"); assert.deepEqual(preview, repeated); assert.deepEqual(draft, before);
  draft.claims[0].text = "Changed"; assert.equal(preview.aiDraftPreview.claims[0].text, "A recorded incident exists.");
});

test("fails closed for invalid validation, wrong family, and binding mismatches", () => {
  const brief = buildAiBrief(caseItem(), { reportFamily: "management", generatedAt: "2026-10-28T12:00:00.000Z" }); const draft = draftFor(brief); const validation = validateAiDraft(draft, brief);
  assert.throws(() => buildManagementAiDraftPreview({ draft, brief, validation: { ...validation, valid: false } }), /Validate/);
  const executive = draftFor(brief, "executive"); assert.throws(() => buildManagementAiDraftPreview({ draft: executive, brief, validation: { ...validation, normalisedDraft: executive } }), /matches|Management/);
  const mismatched = structuredClone(draft); mismatched.sourceAiBrief.sourceFingerprint = "wrong"; assert.throws(() => buildManagementAiDraftPreview({ draft: mismatched, brief, validation }), /matches/);
});
