import test from "node:test";
import assert from "node:assert/strict";
import JSZip from "jszip";

import {
  buildSplitReasoningPackageFiles,
  generateSplitReasoningPackageZip,
  projectSplitReasoningSections,
  sanitizeSplitReasoningValue,
  serializeSplitReasoningJson,
  splitSectionPayload,
  utf8ByteSize,
} from "./splitReasoningPackage.js";

function fixture() {
  return {
    id: "case-1", name: "Representative Case", description: "Complete case description", status: "open",
    actionSummary: { currentFocus: "Preserve this focus", nextActions: [{ id: "a-1", text: "Act", completed: false }], importantReminders: ["Remember"], strategyFocus: ["Strategy focus"], criticalDeadlines: ["2026-08-01"] },
    parties: [{ id: "party-1", name: "Owner" }],
    incidents: [
      { id: "inc-archived", title: "Archived incident", eventDate: "2024-01-01", description: "Full archived description", notes: "Full notes", status: "archived", linkedEvidenceIds: ["ev-1"], linkedPartyIds: ["party-1"], sequenceGroup: "Thread A", attachments: [{ id: "att-1", name: "photo.jpg", mimeType: "image/jpeg", size: 42, storage: { imageId: "img-1" }, dataUrl: "data:image/jpeg;base64,secret" }] },
      { id: "inc-resolved", title: "Resolved incident", eventDate: "2024-01-02", status: "resolved" },
    ],
    evidence: [{ id: "ev-1", title: "Evidence", date: "2024-01-01", description: "Full evidence description", sourceType: "email", functionSummary: "Proves notice", verificationStatus: "verified", linkedIncidentIds: ["inc-archived"], backupDataUrl: "secret" }],
    documents: [{ id: "doc-1", title: "Document", date: "2024-01-03", textContent: "The complete extracted document text must survive." }],
    strategy: [{ id: "str-1", title: "Archived plan", status: "archived", objective: "Objective", rationale: "Rationale", ownerPartyId: "party-1", linkedRecordIds: ["inc-archived"], sequenceGroup: "Thread A" }],
    watchItems: [{ id: "watch-1", title: "Closed watch", status: "resolved", watchFor: "Monitor only", linkedRecordIds: ["inc-archived", "missing-id"], observations: [{ id: "obs-1", date: "2024-01-01", text: "First" }, { id: "obs-2", date: "2024-02-01", text: "Second" }, { id: "obs-3", date: "2024-03-01", text: "Third" }, { id: "obs-4", date: "2024-04-01", text: "Fourth" }] }],
    ledger: [{ id: "led-1", title: "Payment", paymentDate: "2024-01-04", amount: 100 }],
  };
}

test("projects the complete substantive case without filtering or truncating", () => {
  const original = fixture();
  const before = structuredClone(original);
  const sections = projectSplitReasoningSections(original, { exportedAt: "2026-07-25T12:00:00.000Z" });
  assert.deepEqual(original, before);
  assert.equal(sections.summary.currentFocus, "Preserve this focus");
  assert.deepEqual(sections.summary.actionSummary.nextActions, before.actionSummary.nextActions);
  assert.deepEqual(sections.incidents.incidents.map((item) => item.id), ["inc-archived", "inc-resolved"]);
  assert.equal(sections.incidents.incidents[0].description, "Full archived description");
  assert.equal(sections.evidence.evidence[0].id, "ev-1");
  assert.equal(sections.documents.documents[0].textContent, "The complete extracted document text must survive.");
  assert.equal(sections.strategy.strategy[0].status, "archived");
  assert.equal(sections.watch.watchItems[0].status, "resolved");
  assert.equal(sections.watch.watchItems[0].observations.length, 4);
  assert.equal(sections.watch.factualStatus, "monitoring_or_unconfirmed_context_not_established_fact");
  assert.ok(sections.ledger.ledger.some((item) => item.id === "led-1"));
});

test("chronology and relationships remain compact reference indexes", () => {
  const sections = projectSplitReasoningSections(fixture());
  assert.ok(sections.chronology.chronology.some((item) => item.sourceId === "inc-archived" && item.sourceType === "incident"));
  const link = sections.relationships.relationships.find((item) => item.sourceId === "str-1" && item.relationshipType === "strategy_owner");
  assert.deepEqual(link, { sourceType: "strategy", sourceId: "str-1", targetType: "party", targetId: "party-1", relationshipType: "strategy_owner" });
  assert.equal(Object.hasOwn(link, "record"), false);
  assert.ok(sections.relationships.relationships.some((item) => item.relationshipType === "sequence_group_membership"));
  assert.ok(sections.relationships.relationships.some((item) => item.sourceType === "watch"));
  assert.ok(sections.relationships.missingTargetWarnings.some((item) => item.targetId === "missing-id"));
});

test("recursive sanitizer excludes binary fields and values while preserving metadata", () => {
  const value = sanitizeSplitReasoningValue({ nested: { dataUrl: "secret", backupDataUrl: "secret", payload: new Uint8Array([1, 2]), attachment: { name: "safe.pdf", mimeType: "application/pdf", size: 12, storage: { imageId: "safe-ref" } } } });
  assert.deepEqual(value, { nested: { attachment: { name: "safe.pdf", mimeType: "application/pdf", size: 12, storage: { imageId: "safe-ref" } } } });
  assert.doesNotThrow(() => serializeSplitReasoningJson(value));
});

test("UTF-8 byte measurement counts encoded bytes", () => {
  assert.equal(utf8ByteSize("a😀"), 5);
});

test("section splitting is deterministic and only separates complete records", () => {
  const records = [{ id: "one", text: "é".repeat(40) }, { id: "two", text: "x".repeat(40) }, { id: "three", text: "y".repeat(40) }];
  const parts = splitSectionPayload("03-incidents", { incidents: records }, "incidents", 180);
  assert.ok(parts.length > 1);
  assert.deepEqual(parts.flatMap((part) => part.payload.incidents), records);
  assert.deepEqual(parts.map((part) => part.filename), parts.map((_, index) => `03-incidents-part-${String(index + 1).padStart(2, "0")}.json`));
  assert.ok(parts.every((part) => part.payload.partCount === parts.length));
});

test("README inventory exactly matches generated files and ZIP generation succeeds", async () => {
  const files = buildSplitReasoningPackageFiles(fixture(), { exportedAt: "2026-07-25T12:00:00.000Z", targetBytes: 900 });
  const readme = JSON.parse(files[0].json);
  assert.deepEqual(readme.orderedFiles, files.map((file) => file.filename));
  assert.ok(readme.orderedFiles.includes("10-ledger.json"));
  assert.ok(readme.orderedFiles.includes("11-sequence-groups.json"));
  assert.equal(readme.recordCounts.incidents, 2);
  const incidentFiles = readme.files.filter((file) => file.filename.includes("incidents"));
  assert.ok(incidentFiles.every((file) => incidentFiles.length === 1 || file.partCount === incidentFiles.length));
  const result = await generateSplitReasoningPackageZip(fixture(), { exportedAt: "2026-07-25T12:00:00.000Z", outputType: "uint8array" });
  const zip = await JSZip.loadAsync(result.data);
  assert.deepEqual(Object.keys(zip.files), result.files.map((file) => file.filename));
});
