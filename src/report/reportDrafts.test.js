import assert from "node:assert/strict";
import test from "node:test";
import { getClientUpdateDraftFreshness, getClientUpdateSavedDraft, getClientUpdateSavedDrafts, getExecutiveDraftFreshness, getExecutiveSavedDraft, getExecutiveSavedDrafts, buildClientUpdateDraftCandidate, buildExecutiveDraftCandidate, verifyClientUpdateSavedDraft } from "./reportDrafts.js";
import { verifyReportRevisionChecksum } from "./reportLifecycle.js";

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
