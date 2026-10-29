import assert from "node:assert/strict";
import test from "node:test";
import { buildAiBrief } from "./aiBrief.js";
import { buildClientAiDraftPreview } from "./clientAiDraftPreview.js";
import { validateAiDraft } from "./aiDraft.js";
import { buildClientAiDraftCandidate, buildClientUpdateLifecycleCandidate, getClientUpdateSavedDraft, verifyClientUpdateSavedDraft } from "./reportDrafts.js";
import { buildReportOutput } from "./reportOutputs.js";

function source() { return { id: "client-ai-case", name: "Synthetic Client Case", revision: 4, updatedAt: "2026-10-29T10:00:00.000Z", issues: [{ id: "issue-a", reference: "ISS-001", name: "Matter" }], incidents: [{ id: "incident-a", title: "Recorded event", sequenceGroupId: "issue-a", sequenceGroup: "Matter" }], evidence: [], documents: [], ledger: [], strategy: [], watchItems: [] }; }
function draft(brief) { const record = brief.recordReferences.find((item) => item.recordId === "incident-a"); return { schema: { id: "proveit.ai-draft", version: 1 }, reportFamily: "client", case: { id: brief.case.id }, scope: { type: "case" }, sourceAiBrief: { sourceFingerprint: brief.source.sourceFingerprint, caseRevision: brief.source.caseRevision }, sections: [{ id: "overview", heading: "Overview", narrative: "A recorded matter requires review.", claimIds: ["claim-1"] }], claims: [{ id: "claim-1", classification: "recorded_fact", text: "A recorded event is available for review.", sourceReferences: [{ recordType: record.recordType, recordId: record.recordId, scopeRelation: record.scopeRelation, technicalSourceId: "incidentSchedule", issueId: record.issue.issueId }] }], unresolvedQuestions: [], evidenceGaps: [], recommendations: [] }; }

test("Client AI preview is detached, language-bound, whole-case-only, and preserves claim references", () => {
  const brief = buildAiBrief(source(), { reportFamily: "client", scope: "case", generatedAt: "2026-10-29T12:00:00.000Z" }); const input = draft(brief); const validation = validateAiDraft(input, brief);
  const preview = buildClientAiDraftPreview({ draft: input, brief, validation, language: "de", freshness: "current" });
  assert.equal(preview.kind, "client-ai-draft-preview"); assert.equal(preview.aiDraftPreview.language, "de"); assert.equal(preview.source.scope.type, "case"); assert.equal(preview.aiDraftPreview.claims[0].sourceReferences[0].scopeRelation, "direct");
  input.claims[0].text = "changed"; assert.equal(preview.aiDraftPreview.claims[0].text, "A recorded event is available for review.");
  assert.throws(() => buildClientAiDraftPreview({ draft: validation.normalisedDraft, brief, validation, language: "fr" }), /language/);
  assert.throws(() => buildClientAiDraftPreview({ draft: { ...validation.normalisedDraft, scope: { type: "issue", issueId: "issue-a" } }, brief, validation, language: "en" }), /does not match/);
});

test("Client AI Draft acceptance stores a distinct immutable subtype without changing legacy text slots", async () => {
  const caseItem = { ...source(), generatedReportVersions: { en: "legacy English" } }; const brief = buildAiBrief(caseItem, { reportFamily: "client", scope: "case", generatedAt: "2026-10-29T12:00:00.000Z" }); const input = draft(brief); const validation = validateAiDraft(input, brief); const preview = buildClientAiDraftPreview({ draft: input, brief, validation, language: "en", freshness: "current" });
  const candidate = await buildClientAiDraftCandidate({ caseItem, aiDraft: input, aiBrief: brief, validation, previewDocument: preview, markdown: buildReportOutput(preview, "markdown").content, json: buildReportOutput(preview, "json").content, language: "en", currentSourceFingerprint: brief.source.sourceFingerprint, currentBriefCaseRevision: brief.source.caseRevision, now: "2026-10-29T13:00:00.000Z", createId: (() => { const ids = ["client-ai-report", "client-ai-revision"]; return () => ids.shift(); })() });
  const saved = { ...caseItem, reportLibrary: candidate.reportLibrary }; assert.equal(candidate.revision.content.clientAiDraft.language, "en"); assert.equal(getClientUpdateSavedDraft(saved, "client-ai-revision").revision.content.clientAiDraft.acceptedDraft.claims[0].id, "claim-1"); assert.equal((await verifyClientUpdateSavedDraft(saved, "client-ai-revision")).valid, true); assert.equal(saved.generatedReportVersions.en, "legacy English");
  await assert.rejects(buildClientUpdateLifecycleCandidate({ caseItem: saved, revisionId: "client-ai-revision", toStatus: "in_review", currentFingerprint: brief.source.sourceFingerprint }), /not available/);
  await assert.rejects(buildClientAiDraftCandidate({ caseItem: saved, aiDraft: input, aiBrief: brief, validation, previewDocument: preview, markdown: buildReportOutput(preview, "markdown").content, json: buildReportOutput(preview, "json").content, language: "en", currentSourceFingerprint: brief.source.sourceFingerprint, currentBriefCaseRevision: brief.source.caseRevision, createId: () => "new" }), /already been accepted/);
});
