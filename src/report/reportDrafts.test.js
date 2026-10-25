import assert from "node:assert/strict";
import test from "node:test";
import { getExecutiveDraftFreshness, getExecutiveSavedDraft, getExecutiveSavedDrafts, buildExecutiveDraftCandidate } from "./reportDrafts.js";
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
