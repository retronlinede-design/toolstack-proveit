import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildAiWorkspaceCurrentCase, buildAiWorkspaceManifest } from "./aiWorkspace.js";

const attachment = { id: "attachment-1", name: "email.pdf", mimeType: "application/pdf", size: 42, kind: "file", dataUrl: "data:application/pdf;base64,secret", backupDataUrl: "backup-secret", storage: { type: "indexeddb", imageId: "internal-cache-id" }, emailMeta: { subject: "Repair", dataUrl: "nested-secret" } };
const fixture = () => ({
  id: "case-1", revision: 12, name: "Finkenweg Housing", category: "housing", status: "open", description: "Housing dispute", notes: "Case notes", privacyLock: { pin: "1234" }, auditLog: [{ message: "internal" }], generatedReportText: "generated", tags: ["urgent"], createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-09-12T00:00:00.000Z",
  issues: [{ id: "issue-1", reference: "ISS-001", name: "Habitability", description: "Repairs", status: "open", priority: "high", ownerPartyId: "party-1", reviewDate: "2026-10-01" }],
  parties: [{ id: "party-1", name: "Tenant", roles: ["tenant"], contact: { email: "tenant@example.test" } }],
  incidents: [{ id: "inc-1", type: "incidents", title: "Leak", eventDate: "2026-02-01", sequenceGroupId: "issue-1", sequenceGroup: "Habitability", linkedEvidenceIds: ["ev-1"], linkedRecordIds: ["missing-record"], linkedIncidentRefs: [{ incidentId: "inc-2", type: "RELATED_TO" }], attachments: [attachment] }, { id: "inc-2", type: "incidents", title: "Notice", date: "2026-02-02" }],
  evidence: [{ id: "ev-1", type: "evidence", title: "Photo", capturedAt: "2026-02-03", sequenceGroupId: "issue-1", linkedIncidentIds: ["inc-1"], attachments: [attachment], availability: { digital: { hasDigital: true, files: [attachment] } } }],
  documents: [{ id: "doc-1", title: "Letter", documentDate: "2026-02-04", textContent: "Full letter text", basedOnEvidenceIds: ["ev-1"], linkedRecordIds: ["inc-1"], attachments: [attachment] }],
  ledger: [{ id: "led-1", label: "Rent", expectedAmount: 1000, paidAmount: 750, differenceAmount: 250, currency: "EUR", paymentDate: "2026-02-05", linkedRecordIds: ["doc-1"] }, { id: "led-2", label: "USD", expectedAmount: 10, paidAmount: 8, differenceAmount: 2, currency: "USD" }],
  tasks: [{ id: "task-open", type: "tasks", title: "Request repair", status: "open", dueDate: "2026-02-06", description: "Ask landlord", linkedRecordIds: ["inc-1"] }, { id: "task-done", type: "tasks", title: "Legacy complete", status: "done", description: "Keep this record" }],
  strategy: [{ id: "str-1", type: "strategy", title: "Escalate", ownerPartyId: "party-1", linkedRecordIds: ["inc-1"], sequenceGroupId: "issue-1" }],
  watchItems: [{ id: "watch-1", type: "watch", title: "Response", linkedPartyIds: ["party-1"], observations: [{ id: "obs-1", date: "2026-02-07", text: "No response" }] }],
  actionSummary: { currentFocus: "Get repair", nextActions: [{ text: "Write" }], criticalDeadlines: ["2026-03-01"] },
});

test("AI Workspace retains its revision-safe envelope and uses a dedicated complete projection", () => {
  const snapshot = buildAiWorkspaceCurrentCase(fixture(), { exportedAt: "2026-09-12T12:00:00.000Z" });
  assert.equal(snapshot.caseId, "case-1"); assert.equal(snapshot.baseRevision, 12); assert.equal(snapshot.importableAsBackup, false); assert.equal(snapshot.includesBinaryData, false);
  assert.equal(snapshot.projectionContractVersion, "ai-workspace-case-1.0"); assert.equal(snapshot.projection.contractVersion, "ai-workspace-case-1.0"); assert.equal(snapshot.projection.exportedAt, snapshot.exportedAt);
});

test("AI Workspace is complete past V2 limits and has source/export count parity", () => {
  const caseItem = fixture(); caseItem.evidence = Array.from({ length: 81 }, (_, i) => ({ id: `ev-${i}`, title: `Evidence ${i}` })); caseItem.incidents = Array.from({ length: 61 }, (_, i) => ({ id: `inc-${i}`, title: `Incident ${i}` })); caseItem.documents = Array.from({ length: 81 }, (_, i) => ({ id: `doc-${i}`, title: `Document ${i}` })); caseItem.ledger = Array.from({ length: 76 }, (_, i) => ({ id: `led-${i}`, label: `Payment ${i}`, currency: "EUR" })); caseItem.tasks = Array.from({ length: 13 }, (_, i) => ({ id: `task-${i}`, title: `Task ${i}`, status: i === 12 ? "done" : "open" }));
  const projection = buildAiWorkspaceCurrentCase(caseItem).projection;
  assert.equal(projection.canonical.evidence.length, 81); assert.equal(projection.canonical.incidents.length, 61); assert.equal(projection.canonical.documents.length, 81); assert.equal(projection.canonical.ledger.length, 76); assert.equal(projection.canonical.tasks.length, 13); assert.equal(projection.derived.countParity, true);
});

test("AI Workspace preserves stable IDs, Issue membership, raw links, and resolution diagnostics", () => {
  const projection = buildAiWorkspaceCurrentCase(fixture()).projection; const incident = projection.canonical.incidents.find((item) => item.id === "inc-1");
  assert.equal(incident.sequenceGroupId, "issue-1"); assert.equal(projection.canonical.issues[0].reference, "ISS-001"); assert.deepEqual(incident.linkedEvidenceIds, ["ev-1"]);
  assert.ok(projection.derived.relationships.resolvedReferences.some((item) => item.targetId === "ev-1")); assert.ok(projection.derived.relationships.unresolvedReferences.some((item) => item.targetId === "missing-record"));
});

test("AI Workspace includes safe attachment metadata only and strips credentials and implementation state", () => {
  const snapshot = buildAiWorkspaceCurrentCase(fixture()); const serialized = JSON.stringify(snapshot); const output = snapshot.projection.canonical.evidence[0].attachments[0];
  assert.equal(output.name, "email.pdf"); assert.equal(output.emailMeta.subject, "Repair"); assert.equal(output.emailMeta.dataUrl, undefined); assert.equal(output.dataUrl, undefined); assert.equal(output.storage, undefined);
  for (const forbidden of ["1234", "privacyLock", "dataUrl", "backupDataUrl", "internal-cache-id", "auditLog", "generatedReportText"]) assert.equal(serialized.includes(forbidden), false, forbidden);
});

test("AI Workspace separates canonical, derived, and context data and keeps complete task/actions", () => {
  const projection = buildAiWorkspaceCurrentCase(fixture()).projection;
  assert.equal(projection.canonical.tasks.length, 2); assert.equal(projection.canonical.tasks.find((item) => item.id === "task-done").status, "done"); assert.equal(projection.canonical.actionSummary.currentFocus, "Get repair"); assert.equal(projection.canonical.incidents[0].authority, "canonical_stored_case_data"); assert.ok(Array.isArray(projection.derived.chronology)); assert.equal(projection.context.userEntered.caseNotes, "Case notes"); assert.deepEqual(projection.context.generatedOrHeuristic.summaries, []);
});

test("AI Workspace chronology labels undated records instead of asserting a created-date fallback", () => {
  const caseItem = fixture(); caseItem.tasks = [{ id: "undated", title: "Undated", status: "open", createdAt: "2026-02-01T00:00:00.000Z" }]; const item = buildAiWorkspaceCurrentCase(caseItem).projection.derived.chronology.find((entry) => entry.id === "undated");
  assert.equal(item.date, ""); assert.equal(item.dateBasis, "undated_created_at_available"); assert.equal(item.createdAt, "2026-02-01T00:00:00.000Z");
});

test("AI Workspace ledger totals are deterministic and currency-separated", () => {
  const totals = buildAiWorkspaceCurrentCase(fixture()).projection.derived.ledgerTotalsByCurrency;
  assert.deepEqual(totals.map((item) => [item.currency, item.expectedTotal, item.paidTotal, item.differenceTotal]), [["EUR", 1000, 750, 250], ["USD", 10, 8, 2]]);
});

test("AI Workspace remains non-importable and the application rejects reasoning exports", () => {
  const snapshot = buildAiWorkspaceCurrentCase(fixture()); const app = readFileSync("src/App.jsx", "utf8"); assert.equal(snapshot.projection.importable, false); assert.match(app, /exportType === "CASE_REASONING_EXPORT" \|\| parsed\?\.importable === false/);
});

test("AI Workspace manifest stays metadata-only and uses the initial revision for legacy cases", () => {
  const manifest = buildAiWorkspaceManifest({ ...fixture(), revision: undefined }, { exportedAt: "2026-09-12T12:00:00.000Z" }); assert.equal(manifest.baseRevision, 1); assert.equal(Object.hasOwn(manifest, "projection"), false); assert.equal(manifest.snapshotFile, "CURRENT_CASE.json");
});
