import assert from "node:assert/strict";
import test from "node:test";
import { buildClientUpdateDraftCandidate, buildClientUpdateLifecycleCandidate, buildExecutiveAiDraftCandidate, buildExecutiveAiDraftLifecycleCandidate, buildExecutiveDraftCandidate, buildLegacyClientUpdateDraftCandidate, buildManagementAiDraftCandidate, buildManagementAiDraftLifecycleCandidate, getClientUpdateDraftFreshness, getClientUpdateSavedDraft, getClientUpdateSavedDrafts, getExecutiveDraftFreshness, getExecutiveSavedDraft, getExecutiveSavedDrafts, getLegacyClientUpdateNarratives, getManagementAiDraft, getManagementAiDraftFreshness, getManagementAiDrafts, verifyClientUpdateSavedDraft, verifyExecutiveAiDraft, verifyManagementAiDraft } from "./reportDrafts.js";
import { verifyReportRevisionChecksum } from "./reportLifecycle.js";
import { buildAiBrief } from "./aiBrief.js";
import { validateAiDraft } from "./aiDraft.js";
import { buildManagementAiDraftPreview } from "./managementAiDraftPreview.js";
import { buildExecutiveAiDraftPreview } from "./executiveAiDraftPreview.js";

const TIME = "2026-10-25T12:00:00.000Z";

function document(scope = { type: "case" }) {
  return {
    schemaVersion: 1,
    report: { id: "executive", title: "Executive Report", generatedAt: TIME },
    source: { caseId: "case-1", caseName: "Synthetic case", sourceRevision: { fingerprint: "source-a" }, scope },
    sections: [
      { id: "key-findings", items: [{ id: "incident-1", sourceReference: { recordType: "incident", recordId: "incident-1", title: "Recorded incident", label: "Incident: incident-1" } }] },
      { id: "contradictions-and-questions", groups: [{ id: "unresolved-references", items: [{ id: "missing", sourceReference: { recordType: "evidence", recordId: "evidence-missing", title: "Recorded evidence", label: "Evidence: evidence-missing" } }] }] },
    ],
  };
}

function caseItem(reportLibrary) {
  return { id: "case-1", revision: 4, ...(reportLibrary ? { reportLibrary } : {}) };
}

function clientDocument(language = "en") {
  return {
    schemaVersion: 1,
    report: { id: "client", title: "Client Update", generatedAt: TIME },
    source: { caseId: "case-1", caseName: "Synthetic case", sourceRevision: { fingerprint: "source-a" }, scope: { type: "case", isValid: true } },
    sections: [{ id: "client-update-overview", heading: "Client Update Overview", items: [`${language} snapshot`] }],
  };
}

function clientInput(overrides = {}) {
  return {
    caseItem: caseItem(),
    reportDocument: clientDocument(),
    language: "en",
    acceptedNarrative: "# REPORT_TITLE\nClient Update\n\n# YOUR_SITUATION\nRecorded narrative.",
    markdown: "# Client Update",
    json: '{"report":"client"}',
    sourceCaseRevision: 4,
    sourceFingerprint: "source-a",
    promptRevision: "client-report-prompt-v2",
    provenance: { citations: [], claims: [] },
    now: TIME,
    createId: ids("client-report-1", "client-revision-1"),
    ...overrides,
  };
}

function ids(...values) {
  let index = 0;
  return () => values[index++] || `generated-${index}`;
}

function managementCase(reportLibrary) { return { id: "management-case", name: "Management Case", revision: 7, updatedAt: "2026-10-28T10:00:00.000Z", issues: [{ id: "issue-a", reference: "ISS-001", name: "Matter", status: "open" }], incidents: [{ id: "incident-a", title: "Recorded incident", sequenceGroupId: "issue-a", sequenceGroup: "Matter" }], evidence: [], documents: [], ledger: [], strategy: [], watchItems: [], ...(reportLibrary ? { reportLibrary } : {}) }; }
function managementDraft(brief, suffix = "") { const reference = brief.recordReferences[0]; return { schema: { id: "proveit.ai-draft", version: 1 }, reportFamily: "management", case: { id: brief.case.id }, scope: { type: "case" }, sourceAiBrief: { sourceFingerprint: brief.source.sourceFingerprint, caseRevision: brief.source.caseRevision }, sections: [{ id: "overview", heading: "Management Overview", narrative: `AI narrative ${suffix}`, claimIds: ["fact", "allegation"] }], claims: [{ id: "fact", classification: "recorded_fact", text: "A recorded incident exists.", sourceReferences: [{ recordType: reference.recordType, recordId: reference.recordId, scopeRelation: reference.scopeRelation, technicalSourceId: reference.sourceTechnicalReportIds[0], issueId: reference.issue.issueId }] }, { id: "allegation", classification: "allegation", text: "An allegation requires review.", sourceReferences: [{ recordType: reference.recordType, recordId: reference.recordId, scopeRelation: reference.scopeRelation, technicalSourceId: reference.sourceTechnicalReportIds[0], issueId: reference.issue.issueId }] }], unresolvedQuestions: [{ id: "question", text: "What response is recorded?", sourceReferences: [] }], evidenceGaps: [{ id: "gap", text: "Further evidence may be required.", sourceReferences: [] }], recommendations: [{ id: "action", text: "Review the recorded material.", sourceReferences: [] }] }; }
function managementInput(overrides = {}) { const item = managementCase(); const brief = buildAiBrief(item, { reportFamily: "management", generatedAt: "2026-10-28T12:00:00.000Z" }); const draft = managementDraft(brief); const validation = validateAiDraft(draft, brief); const previewDocument = buildManagementAiDraftPreview({ draft, brief, validation, freshness: "current" }); return { caseItem: item, aiDraft: draft, aiBrief: brief, validation, previewDocument, currentSourceFingerprint: brief.source.sourceFingerprint, currentBriefCaseRevision: brief.source.caseRevision, currentCaseRevision: item.revision, now: TIME, createId: ids("management-report", "management-revision-1"), ...overrides }; }

test("Executive Draft snapshots existing outputs and validates immutable provenance", async () => {
  const result = await buildExecutiveDraftCandidate({
    caseItem: caseItem(), reportDocument: document(), markdown: "# Executive Report", json: '{"report":"executive"}', now: TIME, createId: ids("report-1", "revision-1"),
  });
  assert.equal(result.manifest.id, "report-1");
  assert.equal(result.revision.versionNumber, 1);
  assert.equal(result.revision.content.markdown, "# Executive Report");
  assert.equal(result.revision.content.json, '{"report":"executive"}');
  assert.equal(result.revision.provenance.citations[0].relationship, "direct");
  assert.equal(result.revision.provenance.citations[1].relationship, "unresolved");
  assert.equal((await verifyReportRevisionChecksum(result.revision)).valid, true);
});

test("Executive Draft revisions preserve the original immutable snapshot and parent chain", async () => {
  const first = await buildExecutiveDraftCandidate({
    caseItem: caseItem(), reportDocument: document(), markdown: "first", json: "first-json", now: TIME, createId: ids("report-1", "revision-1"),
  });
  const laterDocument = document();
  laterDocument.sections[0].items[0].sourceReference.title = "Changed live preview";
  const second = await buildExecutiveDraftCandidate({
    caseItem: caseItem(first.reportLibrary), reportDocument: laterDocument, markdown: "second", json: "second-json", reportId: "report-1", now: "2026-10-26T12:00:00.000Z", createId: ids("revision-2"),
  });
  assert.equal(second.revision.versionNumber, 2);
  assert.equal(second.revision.parentRevisionId, "revision-1");
  assert.equal(second.reportLibrary.revisions["revision-1"].content.markdown, "first");
  assert.equal(getExecutiveSavedDrafts(caseItem(second.reportLibrary)).length, 2);
  assert.equal(getExecutiveSavedDraft(caseItem(second.reportLibrary), "revision-1").revision.content.json, "first-json");
});

test("Executive Draft rejects invalid scope and reports current, stale, and unavailable historical freshness", async () => {
  await assert.rejects(
    buildExecutiveDraftCandidate({ caseItem: caseItem(), reportDocument: document({ type: "sequenceGroup", issueId: "" }), markdown: "draft", json: "json", now: TIME }),
    /canonical case or Issue scope/
  );
  const saved = await buildExecutiveDraftCandidate({ caseItem: caseItem(), reportDocument: document({ type: "sequenceGroup", issueId: "issue-1" }), markdown: "draft", json: "json", now: TIME, createId: ids("report-1", "revision-1") });
  assert.equal(getExecutiveDraftFreshness(saved.revision, "source-a", true), "current");
  assert.equal(getExecutiveDraftFreshness(saved.revision, "source-b", true), "stale");
  assert.equal(getExecutiveDraftFreshness(saved.revision, "source-a", false), "unknown");
});

test("Client Update candidate snapshots validated English and German narratives without mutating inputs", async () => {
  const input = clientInput();
  input.caseItem.generatedReportText = "Legacy Client Update";
  input.caseItem.generatedReportVersions = { en: "Legacy English", de: "Legacy German" };
  const legacySlots = structuredClone(input.caseItem.generatedReportVersions);
  const beforeNarrative = input.acceptedNarrative;
  const english = await buildClientUpdateDraftCandidate(input);
  input.reportDocument.sections[0].items[0] = "Changed after snapshot";
  input.provenance.citations.push({ id: "later", recordType: "incident", recordId: "incident-1", relationship: "direct" });
  assert.equal(english.manifest.reportType, "client");
  assert.equal(english.revision.generationMode, "ai_assisted");
  assert.equal(english.revision.content.clientUpdate.language, "en");
  assert.equal(english.revision.content.clientUpdate.acceptedNarrative, beforeNarrative);
  assert.equal(english.revision.content.reportDocument.sections[0].items[0], "en snapshot");
  assert.deepEqual(english.revision.provenance, { citations: [], claims: [] });
  assert.equal(input.caseItem.generatedReportText, "Legacy Client Update");
  assert.deepEqual(input.caseItem.generatedReportVersions, legacySlots);
  assert.equal((await verifyReportRevisionChecksum(english.revision)).valid, true);

  const german = await buildClientUpdateDraftCandidate(clientInput({ language: "de", reportDocument: clientDocument("de"), acceptedNarrative: "# REPORT_TITLE\nMandantenaktualisierung", createId: ids("client-report-de", "client-revision-de") }));
  assert.equal(german.revision.content.clientUpdate.language, "de");
});

test("Client Update candidate chains revisions and coexists with an Executive revision", async () => {
  const executive = await buildExecutiveDraftCandidate({ caseItem: caseItem(), reportDocument: document(), markdown: "executive", json: "executive-json", now: TIME, createId: ids("executive-report", "executive-revision") });
  const first = await buildClientUpdateDraftCandidate(clientInput({ caseItem: caseItem(executive.reportLibrary), createId: ids("client-report", "client-revision-1") }));
  const second = await buildClientUpdateDraftCandidate(clientInput({ caseItem: caseItem(first.reportLibrary), reportId: "client-report", now: "2026-10-26T12:00:00.000Z", createId: ids("client-revision-2") }));
  assert.equal(second.revision.versionNumber, 2);
  assert.equal(second.revision.parentRevisionId, "client-revision-1");
  assert.equal(second.reportLibrary.revisions["client-revision-1"].content.clientUpdate.language, "en");
  assert.equal(second.reportLibrary.reports["executive-report"].reportType, "executive");
});

test("Client Update saved revisions reopen immutable English and German snapshots with verified freshness", async () => {
  const first = await buildClientUpdateDraftCandidate(clientInput({
    acceptedNarrative: "# REPORT_TITLE\nEnglish historical narrative",
    markdown: "# English historical Markdown",
    json: '{"language":"en","snapshot":1}',
    createId: ids("client-report", "client-revision-en"),
  }));
  const second = await buildClientUpdateDraftCandidate(clientInput({
    caseItem: caseItem(first.reportLibrary),
    reportId: "client-report",
    language: "de",
    reportDocument: clientDocument("de"),
    acceptedNarrative: "# REPORT_TITLE\nDeutsche historische Erzählung",
    markdown: "# Deutsche historische Markdown-Ausgabe",
    json: '{"language":"de","snapshot":2}',
    now: "2026-10-26T12:00:00.000Z",
    createId: ids("client-revision-de"),
  }));
  const savedCase = caseItem(second.reportLibrary);
  const before = structuredClone(savedCase.reportLibrary);
  const revisions = getClientUpdateSavedDrafts(savedCase);
  const english = getClientUpdateSavedDraft(savedCase, "client-revision-en");
  const german = getClientUpdateSavedDraft(savedCase, "client-revision-de");

  assert.equal(revisions.length, 2);
  assert.equal(english.revision.content.clientUpdate.language, "en");
  assert.equal(german.revision.content.clientUpdate.language, "de");
  assert.equal(english.revision.content.clientUpdate.acceptedNarrative, "# REPORT_TITLE\nEnglish historical narrative");
  assert.equal(english.revision.content.reportDocument.sections[0].items[0], "en snapshot");
  assert.equal(english.revision.content.markdown, "# English historical Markdown");
  assert.equal(english.revision.content.json, '{"language":"en","snapshot":1}');
  assert.equal(getClientUpdateDraftFreshness(english.revision, "source-a"), "current");
  assert.equal(getClientUpdateDraftFreshness(english.revision, "changed-source"), "stale");
  assert.equal(getClientUpdateDraftFreshness(english.revision, ""), "unknown");
  assert.equal((await verifyClientUpdateSavedDraft(savedCase, "client-revision-en")).valid, true);
  assert.deepEqual(savedCase.reportLibrary, before);

  const corruptedCase = caseItem(structuredClone(second.reportLibrary));
  corruptedCase.reportLibrary.revisions["client-revision-en"].content.markdown = "tampered historical output";
  const corrupted = await verifyClientUpdateSavedDraft(corruptedCase, "client-revision-en");
  assert.equal(corrupted.valid, false);
});

test("Client Update lifecycle review and approval preserve immutable snapshots and require a current named human approval", async () => {
  const first = await buildClientUpdateDraftCandidate(clientInput({ createId: ids("client-report", "client-revision-en") }));
  const second = await buildClientUpdateDraftCandidate(clientInput({
    caseItem: caseItem(first.reportLibrary),
    reportId: "client-report",
    language: "de",
    reportDocument: clientDocument("de"),
    acceptedNarrative: "# REPORT_TITLE\nDeutsche Fassung",
    now: "2026-10-26T12:00:00.000Z",
    createId: ids("client-revision-de"),
  }));
  const original = structuredClone(second.reportLibrary.revisions["client-revision-de"]);
  const review = await buildClientUpdateLifecycleCandidate({
    caseItem: caseItem(second.reportLibrary),
    revisionId: "client-revision-de",
    toStatus: "in_review",
    currentFingerprint: "source-a",
    now: "2026-10-27T12:00:00.000Z",
  });
  assert.equal(review.revision.lifecycle.status, "in_review");
  assert.equal(review.revision.lifecycle.review.submittedAt, "2026-10-27T12:00:00.000Z");
  assert.equal(review.manifest.status, "in_review");
  assert.deepEqual(review.revision.content, original.content);
  assert.equal(review.revision.contentChecksum, original.contentChecksum);
  assert.equal((await verifyReportRevisionChecksum(review.revision)).valid, true);

  const approved = await buildClientUpdateLifecycleCandidate({
    caseItem: caseItem(review.reportLibrary),
    revisionId: "client-revision-de",
    toStatus: "approved",
    reviewerName: "A. Reviewer",
    currentFingerprint: "source-a",
    now: "2026-10-28T12:00:00.000Z",
  });
  assert.equal(approved.revision.lifecycle.status, "approved");
  assert.equal(approved.revision.lifecycle.review.reviewedBy, "A. Reviewer");
  assert.equal(approved.revision.lifecycle.review.reviewedAt, "2026-10-28T12:00:00.000Z");
  assert.equal(approved.manifest.approvedRevisionId, "client-revision-de");
  assert.deepEqual(approved.revision.content, original.content);
  assert.equal(approved.revision.contentChecksum, original.contentChecksum);

  await assert.rejects(buildClientUpdateLifecycleCandidate({ caseItem: caseItem(second.reportLibrary), revisionId: "client-revision-de", toStatus: "approved", reviewerName: "A. Reviewer", currentFingerprint: "source-a" }), /Invalid report lifecycle transition/);
  await assert.rejects(buildClientUpdateLifecycleCandidate({ caseItem: caseItem(review.reportLibrary), revisionId: "client-revision-de", toStatus: "approved", reviewerName: "", currentFingerprint: "source-a" }), /named local human reviewer/);
  await assert.rejects(buildClientUpdateLifecycleCandidate({ caseItem: caseItem(review.reportLibrary), revisionId: "client-revision-de", toStatus: "approved", reviewerName: "A. Reviewer", currentFingerprint: "stale-source" }), /current source fingerprint/);
  await assert.rejects(buildClientUpdateLifecycleCandidate({ caseItem: caseItem(review.reportLibrary), revisionId: "client-revision-de", toStatus: "approved", reviewerName: "A. Reviewer", currentFingerprint: "" }), /current source fingerprint/);
  const corrupt = caseItem(structuredClone(review.reportLibrary));
  corrupt.reportLibrary.revisions["client-revision-de"].content.json = "tampered";
  await assert.rejects(buildClientUpdateLifecycleCandidate({ caseItem: corrupt, revisionId: "client-revision-de", toStatus: "approved", reviewerName: "A. Reviewer", currentFingerprint: "source-a" }), /history is invalid/);
});

test("legacy Client Update text is identified by language and imported only through an explicit unknown-provenance draft", async () => {
  const legacyCase = {
    ...caseItem(),
    generatedReportText: "Fallback English text must not replace a versioned English slot.",
    generatedReportVersions: {
      en: "# REPORT_TITLE\nLegacy English\n\n# YOUR_SITUATION\nRecorded legacy English narrative.\n\n# CURRENT_POSITION\nAwaiting review.",
      de: "# REPORT_TITLE\nLegacy German\n\n# YOUR_SITUATION\nGespeicherte deutsche Erzählung.\n\n# CURRENT_POSITION\nPrüfung ausstehend.",
    },
  };
  const before = structuredClone(legacyCase);
  assert.deepEqual(getLegacyClientUpdateNarratives(legacyCase).map((entry) => [entry.language, entry.sourceSlot]), [["en", "generatedReportVersions.en"], ["de", "generatedReportVersions.de"]]);

  const english = await buildLegacyClientUpdateDraftCandidate({
    caseItem: legacyCase,
    language: "en",
    legacyNarrative: legacyCase.generatedReportVersions.en,
    reportDocument: clientDocument("en"),
    markdown: "legacy English markdown",
    json: "legacy English json",
    sourceCaseRevision: 4,
    sourceFingerprint: "source-a",
    provenance: { citations: [], claims: [] },
    now: TIME,
    createId: ids("legacy-en-report", "legacy-en-revision"),
  });
  assert.equal(english.revision.content.clientUpdate.acceptedNarrative, legacyCase.generatedReportVersions.en);
  assert.deepEqual(english.revision.content.clientUpdate.legacyImport, {
    origin: "legacy_client_update_text",
    sourceSlot: "generatedReportVersions.en",
    language: "en",
    historicalProvenance: "unknown",
    importedAt: TIME,
    snapshotKind: "present_day_case_snapshot",
  });
  assert.equal(english.revision.lifecycle.status, "draft");
  assert.deepEqual(english.revision.lifecycle.review, {});
  assert.deepEqual(legacyCase, before);

  const afterEnglish = { ...legacyCase, reportLibrary: english.reportLibrary };
  assert.deepEqual(getLegacyClientUpdateNarratives(afterEnglish).map((entry) => entry.language), ["de"]);
  await assert.rejects(buildLegacyClientUpdateDraftCandidate({ caseItem: afterEnglish, language: "en", legacyNarrative: legacyCase.generatedReportVersions.en, reportDocument: clientDocument("en"), markdown: "duplicate", json: "duplicate", sourceCaseRevision: 4, sourceFingerprint: "source-a", provenance: { citations: [], claims: [] } }), /unavailable or already has an immutable revision/);
  const german = await buildLegacyClientUpdateDraftCandidate({
    caseItem: afterEnglish,
    language: "de",
    legacyNarrative: legacyCase.generatedReportVersions.de,
    reportDocument: clientDocument("de"),
    markdown: "legacy German markdown",
    json: "legacy German json",
    sourceCaseRevision: 4,
    sourceFingerprint: "source-a",
    provenance: { citations: [], claims: [] },
    now: "2026-10-26T12:00:00.000Z",
    createId: ids("legacy-de-report", "legacy-de-revision"),
  });
  assert.equal(getLegacyClientUpdateNarratives({ ...legacyCase, reportLibrary: german.reportLibrary }).length, 0);
  const review = await buildClientUpdateLifecycleCandidate({ caseItem: caseItem(english.reportLibrary), revisionId: "legacy-en-revision", toStatus: "in_review", currentFingerprint: "source-a" });
  await assert.rejects(buildClientUpdateLifecycleCandidate({ caseItem: caseItem(review.reportLibrary), revisionId: "legacy-en-revision", toStatus: "approved", reviewerName: "A. Reviewer", currentFingerprint: "source-a" }), /unknown historical provenance/);
  assert.deepEqual(getLegacyClientUpdateNarratives(caseItem()).map((entry) => entry.language), []);
});

test("Client Update candidate fails closed for invalid inputs, malformed libraries, duplicate IDs, and binary snapshots", async () => {
  await assert.rejects(buildClientUpdateDraftCandidate(clientInput({ language: "fr" })), /language/);
  await assert.rejects(buildClientUpdateDraftCandidate(clientInput({ provenance: null })), /provenance/);
  await assert.rejects(buildClientUpdateDraftCandidate(clientInput({ provenance: { citations: [], claims: [{ classification: "unsupported" }] } })), /invalid/);
  await assert.rejects(buildClientUpdateDraftCandidate(clientInput({ reportDocument: { ...clientDocument(), source: { ...clientDocument().source, sourceRevision: { fingerprint: "different" } } } })), /fingerprint/);
  await assert.rejects(buildClientUpdateDraftCandidate(clientInput({ reportDocument: { ...clientDocument(), sections: [{ id: "x", value: "data:text/plain,forbidden" }] } })), /invalid/);

  const first = await buildClientUpdateDraftCandidate(clientInput());
  await assert.rejects(buildClientUpdateDraftCandidate(clientInput({ caseItem: caseItem(first.reportLibrary), reportId: "client-report-1", createId: ids("client-revision-1") })), /already exists/);
  const tampered = structuredClone(first.reportLibrary);
  tampered.revisions["client-revision-1"].content.markdown = "tampered";
  await assert.rejects(buildClientUpdateDraftCandidate(clientInput({ caseItem: caseItem(tampered) })), /Existing report library is invalid/);
});

test("Management AI Draft acceptance snapshots exact draft, Brief, preview, provenance, and draft-only lifecycle", async () => {
  const input = managementInput(); const beforeCase = structuredClone(input.caseItem); const beforeDraft = structuredClone(input.aiDraft);
  const accepted = await buildManagementAiDraftCandidate(input);
  assert.equal(accepted.manifest.reportType, "management"); assert.equal(accepted.revision.generationMode, "ai_assisted"); assert.equal(accepted.revision.lifecycle.status, "draft"); assert.deepEqual(accepted.revision.lifecycle.review, {});
  assert.deepEqual(accepted.revision.content.managementAiDraft.acceptedDraft, beforeDraft); assert.deepEqual(accepted.revision.content.managementAiDraft.aiBrief, input.aiBrief);
  assert.equal(accepted.revision.content.reportDocument.kind, "management-ai-draft-preview"); assert.equal(accepted.revision.provenance.claims.find((claim) => claim.id === "allegation").classification, "allegation"); assert.equal(accepted.revision.provenance.citations[0].recordId, "incident-a");
  assert.equal((await verifyReportRevisionChecksum(accepted.revision)).valid, true); assert.deepEqual(input.caseItem, beforeCase);
  input.aiDraft.claims[0].text = "Changed"; assert.equal(accepted.revision.content.managementAiDraft.acceptedDraft.claims[0].text, "A recorded incident exists.");
});

test("Management AI Draft acceptance rejects stale, changed, mismatched, duplicate, and malformed candidates while preserving parent chains", async () => {
  const firstInput = managementInput(); const first = await buildManagementAiDraftCandidate(firstInput);
  await assert.rejects(buildManagementAiDraftCandidate(managementInput({ caseItem: managementCase(first.reportLibrary), createId: ids("duplicate-report", "duplicate-revision") })), /already been accepted/);
  const changedDraft = managementDraft(firstInput.aiBrief, "new revision"); const changedValidation = validateAiDraft(changedDraft, firstInput.aiBrief); const changedPreview = buildManagementAiDraftPreview({ draft: changedDraft, brief: firstInput.aiBrief, validation: changedValidation, freshness: "current" });
  const second = await buildManagementAiDraftCandidate(managementInput({ caseItem: managementCase(first.reportLibrary), aiDraft: changedDraft, validation: changedValidation, previewDocument: changedPreview, reportId: "management-report", now: "2026-10-26T12:00:00.000Z", createId: ids("management-revision-2") }));
  assert.equal(second.revision.parentRevisionId, "management-revision-1"); assert.equal(second.revision.versionNumber, 2); assert.equal(second.reportLibrary.revisions["management-revision-1"].content.managementAiDraft.acceptedDraft.sections[0].narrative, "AI narrative ");
  await assert.rejects(buildManagementAiDraftCandidate(managementInput({ currentSourceFingerprint: "changed" })), /no longer current/);
  await assert.rejects(buildManagementAiDraftCandidate(managementInput({ currentBriefCaseRevision: "changed" })), /source revision is no longer current/);
  const invalid = managementInput(); invalid.aiDraft.sourceAiBrief.sourceFingerprint = "wrong"; await assert.rejects(buildManagementAiDraftCandidate(invalid), /invalid/);
  const tampered = managementCase(first.reportLibrary); tampered.reportLibrary.revisions["management-revision-1"].content.managementAiDraft.acceptedDraft.claims[0].text = "tampered"; await assert.rejects(buildManagementAiDraftCandidate(managementInput({ caseItem: tampered })), /Existing report library is invalid/);
});

test("Management AI Draft history lists ordered immutable snapshots and verifies exact historical content", async () => {
  const firstInput = managementInput(); const first = await buildManagementAiDraftCandidate(firstInput);
  const changedDraft = managementDraft(firstInput.aiBrief, "later"); const validation = validateAiDraft(changedDraft, firstInput.aiBrief); const previewDocument = buildManagementAiDraftPreview({ draft: changedDraft, brief: firstInput.aiBrief, validation, freshness: "current" });
  const second = await buildManagementAiDraftCandidate(managementInput({ caseItem: managementCase(first.reportLibrary), aiDraft: changedDraft, validation, previewDocument, reportId: "management-report", now: "2026-10-26T12:00:00.000Z", createId: ids("management-revision-2") }));
  const savedCase = managementCase(second.reportLibrary); const history = getManagementAiDrafts(savedCase);
  assert.deepEqual(history.map((item) => item.revision.id), ["management-revision-2", "management-revision-1"]);
  assert.equal(getManagementAiDraft(savedCase, "management-revision-1").revision.content.reportDocument.aiDraftPreview.sections[0].narrative, "AI narrative ");
  assert.equal((await verifyManagementAiDraft(savedCase, "management-revision-1")).valid, true);
  assert.equal(getManagementAiDraftFreshness(history[0].revision, history[0].revision.source.fingerprint), "current");
  assert.equal(getManagementAiDraftFreshness(history[0].revision, "changed"), "stale");
  assert.equal(getManagementAiDraftFreshness(history[0].revision, ""), "unknown");
});

test("Management AI Draft history fails closed for tampering, missing snapshots, wrong family, and does not mutate records", async () => {
  const accepted = await buildManagementAiDraftCandidate(managementInput()); const savedCase = managementCase(accepted.reportLibrary); const before = structuredClone(savedCase);
  const tampered = structuredClone(savedCase); tampered.reportLibrary.revisions["management-revision-1"].content.managementAiDraft.acceptedDraft.claims[0].text = "tampered";
  assert.equal((await verifyManagementAiDraft(tampered, "management-revision-1")).valid, false);
  const missing = structuredClone(savedCase); delete missing.reportLibrary.revisions["management-revision-1"].content.managementAiDraft.aiBrief;
  assert.equal((await verifyManagementAiDraft(missing, "management-revision-1")).valid, false);
  const wrongFamily = structuredClone(savedCase); wrongFamily.reportLibrary.revisions["management-revision-1"].content.managementAiDraft.acceptedDraft.reportFamily = "executive";
  assert.equal((await verifyManagementAiDraft(wrongFamily, "management-revision-1")).valid, false);
  assert.deepEqual(savedCase, before);
});

test("Management AI Draft lifecycle requires a named review before a current-source approval and preserves its immutable snapshot", async () => {
  const accepted = await buildManagementAiDraftCandidate(managementInput());
  const savedCase = managementCase(accepted.reportLibrary);
  const original = structuredClone(accepted.revision);
  const options = {
    revisionId: accepted.revision.id,
    currentFingerprint: accepted.revision.source.fingerprint,
    currentBriefCaseRevision: accepted.revision.content.managementAiDraft.sourceAiBrief.caseRevision,
  };
  await assert.rejects(buildManagementAiDraftLifecycleCandidate({ caseItem: savedCase, ...options, toStatus: "in_review", reviewerName: "" }), /Reviewer name/);
  await assert.rejects(buildManagementAiDraftLifecycleCandidate({ caseItem: savedCase, ...options, toStatus: "approved", reviewerName: "Approver" }), /completed named human review/);

  const reviewed = await buildManagementAiDraftLifecycleCandidate({ caseItem: savedCase, ...options, toStatus: "in_review", reviewerName: "R. Reviewer", now: "2026-10-28T12:30:00.000Z" });
  assert.equal(reviewed.revision.lifecycle.status, "in_review");
  assert.equal(reviewed.revision.lifecycle.review.reviewedBy, "R. Reviewer");
  assert.deepEqual(reviewed.revision.lifecycle.review.history.map((entry) => entry.decision), ["reviewed"]);
  assert.deepEqual(reviewed.revision.content, original.content);
  assert.equal(reviewed.revision.contentChecksum, original.contentChecksum);

  const approved = await buildManagementAiDraftLifecycleCandidate({ caseItem: managementCase(reviewed.reportLibrary), ...options, toStatus: "approved", reviewerName: "A. Approver", now: "2026-10-28T13:00:00.000Z" });
  assert.equal(approved.revision.lifecycle.status, "approved");
  assert.equal(approved.revision.lifecycle.review.reviewedBy, "R. Reviewer");
  assert.equal(approved.revision.lifecycle.review.approvedBy, "A. Approver");
  assert.deepEqual(approved.revision.lifecycle.review.history.map((entry) => entry.decision), ["reviewed", "approved"]);
  assert.equal(approved.manifest.approvedRevisionId, accepted.revision.id);
  assert.deepEqual(approved.revision.content, original.content);
  assert.equal(approved.revision.contentChecksum, original.contentChecksum);
  assert.equal((await verifyReportRevisionChecksum(approved.revision)).valid, true);

  await assert.rejects(buildManagementAiDraftLifecycleCandidate({ caseItem: managementCase(reviewed.reportLibrary), ...options, toStatus: "approved", reviewerName: "A. Approver", currentFingerprint: "stale" }), /current source fingerprint/);
  await assert.rejects(buildManagementAiDraftLifecycleCandidate({ caseItem: managementCase(reviewed.reportLibrary), ...options, toStatus: "approved", reviewerName: "A. Approver", currentBriefCaseRevision: "stale" }), /current source revision/);
  await assert.rejects(buildManagementAiDraftLifecycleCandidate({ caseItem: managementCase(approved.reportLibrary), ...options, toStatus: "approved", reviewerName: "A. Approver" }), /Invalid report lifecycle transition/);
  const tampered = managementCase(structuredClone(reviewed.reportLibrary)); tampered.reportLibrary.revisions[accepted.revision.id].content.managementAiDraft.acceptedDraft.claims[0].text = "tampered";
  await assert.rejects(buildManagementAiDraftLifecycleCandidate({ caseItem: tampered, ...options, toStatus: "approved", reviewerName: "A. Approver" }), /history is invalid/);
});

test("Executive AI Draft acceptance and lifecycle preserve an exact bound snapshot alongside legacy Executive drafts", async () => {
  const item = managementCase(); const brief = buildAiBrief(item, { reportFamily: "executive" }); const source = managementDraft(brief); source.reportFamily = "executive";
  const validation = validateAiDraft(source, brief); const preview = buildExecutiveAiDraftPreview({ draft: source, brief, validation, freshness: "current" });
  const accepted = await buildExecutiveAiDraftCandidate({ caseItem: item, aiDraft: source, aiBrief: brief, validation, previewDocument: preview, markdown: "# Executive AI", json: "{\"executive\":true}", currentSourceFingerprint: brief.source.sourceFingerprint, currentBriefCaseRevision: brief.source.caseRevision, currentCaseRevision: item.revision, now: TIME, createId: ids("executive-ai-report", "executive-ai-revision") });
  assert.equal(accepted.revision.generationMode, "ai_assisted"); assert.equal(accepted.revision.content.executiveAiDraft.acceptedDraft.reportFamily, "executive"); assert.equal((await verifyExecutiveAiDraft(managementCase(accepted.reportLibrary), accepted.revision.id)).valid, true);
  await assert.rejects(buildExecutiveAiDraftCandidate({ caseItem: managementCase(accepted.reportLibrary), aiDraft: source, aiBrief: brief, validation, previewDocument: preview, markdown: "# Executive AI", json: "{}", currentSourceFingerprint: brief.source.sourceFingerprint, currentBriefCaseRevision: brief.source.caseRevision, currentCaseRevision: item.revision, createId: ids("other", "other-revision") }), /already been accepted/);
  const options = { revisionId: accepted.revision.id, currentFingerprint: accepted.revision.source.fingerprint, currentBriefCaseRevision: brief.source.caseRevision };
  await assert.rejects(buildExecutiveAiDraftLifecycleCandidate({ caseItem: managementCase(accepted.reportLibrary), ...options, toStatus: "approved", reviewerName: "Approver" }), /completed named human review/);
  const reviewed = await buildExecutiveAiDraftLifecycleCandidate({ caseItem: managementCase(accepted.reportLibrary), ...options, toStatus: "in_review", reviewerName: "Reviewer", now: "2026-10-28T12:30:00.000Z" });
  const approved = await buildExecutiveAiDraftLifecycleCandidate({ caseItem: managementCase(reviewed.reportLibrary), ...options, toStatus: "approved", reviewerName: "Approver", now: "2026-10-28T13:00:00.000Z" });
  assert.deepEqual(approved.revision.lifecycle.review.history.map((entry) => entry.decision), ["reviewed", "approved"]); assert.equal(approved.revision.contentChecksum, accepted.revision.contentChecksum); assert.deepEqual(approved.revision.content, accepted.revision.content);
  await assert.rejects(buildExecutiveAiDraftLifecycleCandidate({ caseItem: managementCase(reviewed.reportLibrary), ...options, toStatus: "approved", reviewerName: "Approver", currentFingerprint: "stale" }), /current source fingerprint/);
});
