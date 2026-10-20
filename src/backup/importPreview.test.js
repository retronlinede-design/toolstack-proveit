import test from "node:test";
import assert from "node:assert/strict";
import { buildImportPreview, createImportPreviewBaseline, matchesImportPreviewBaseline } from "./importPreview.js";

function currentCase(overrides = {}) {
  return {
    id: "case-existing",
    name: "Existing case",
    description: "Original description",
    incidents: [{ id: "inc-1", title: "Original incident" }],
    evidence: [], documents: [], ledger: [], strategy: [], watchItems: [], tasks: [], parties: [], issues: [],
    ...overrides,
  };
}

function fullBackup(overrides = {}) {
  return {
    app: "proveit",
    contractVersion: "2.0",
    exportType: "FULL_BACKUP_ALL",
    binaryData: { expected: 2, included: 1, missing: 1, failed: 0, complete: false },
    data: {
      cases: [
        { id: "case-existing", description: "", incidents: [{ id: "inc-1", title: "Updated incident" }, { id: "inc-2", title: "New incident" }], evidence: [{ id: "ev-1", attachments: [{ id: "att-1", storage: { imageId: "image-1" }, backupDataUrl: "data:image/png;base64,AA" }] }] },
        { id: "case-new", name: "New case", documents: [{ id: "doc-1", title: "New document" }] },
      ],
      folders: [{ id: "folder-1", name: "Imported folder" }],
      quickCaptures: [{ id: "capture-1", attachments: [{ id: "capture-attachment", storage: { imageId: "image-2" } }] }],
    },
    appData: { sequenceGroupMeta: { "case-existing": { name: "Issue metadata" } } },
    ...overrides,
  };
}

test("preview summarises supported full backups using the production merge semantics", () => {
  const preview = buildImportPreview(fullBackup(), { cases: [currentCase(), { id: "case-untouched", name: "Untouched" }], folders: [], quickCaptures: [] });
  assert.equal(preview.ok, true);
  assert.equal(preview.format.label, "Full App Backup v2.0");
  assert.deepEqual(preview.cases, { incomingCount: 2, newCount: 1, matchingCount: 1, untouchedCount: 1, changedExistingCount: 1 });
  assert.deepEqual(preview.records.incidents, { additions: 1, matching: 1 });
  assert.deepEqual(preview.records.documents, { additions: 1, matching: 0 });
  assert.deepEqual(preview.folders, { currentCount: 0, suppliedCount: 1, source: "data" });
  assert.deepEqual(preview.quickCaptures, { currentCount: 0, suppliedCount: 1, willImport: true, skippedBecauseCaseBackup: false });
  assert.deepEqual(preview.sequenceMetadata, { present: true, entryCount: 1 });
});

test("preview accepts supported legacy backups and rejects reasoning exports without attempting a preview merge", () => {
  const legacy = buildImportPreview({ version: "2.1-full-backup", cases: [{ id: "legacy-case", name: "Legacy" }] }, { cases: [] });
  const reasoning = buildImportPreview({ exportType: "CASE_REASONING_EXPORT", importable: false }, { cases: [currentCase()] });
  assert.equal(legacy.ok, true);
  assert.equal(legacy.format.legacy, true);
  assert.equal(reasoning.ok, false);
  assert.equal(reasoning.format.importable, false);
  assert.match(reasoning.warnings[0], /reasoning export/i);
});

test("preview reports sparse patches, explicit empty replacements, and declared attachment limitations precisely", () => {
  const preview = buildImportPreview(fullBackup(), { cases: [currentCase()], folders: [], quickCaptures: [] });
  assert.equal(preview.attachments.referenceCount, 2);
  assert.equal(preview.attachments.embeddedPayloadReferenceCount, 1);
  assert.equal(preview.attachments.restorationGuaranteed, false);
  assert.deepEqual(preview.attachments.declared, { expected: 2, included: 1, missing: 1, failed: 0, complete: false });
  assert.match(preview.warnings.join(" "), /Sparse patches omit/);
  assert.match(preview.warnings.join(" "), /explicit empty value/);
  assert.match(preview.warnings.join(" "), /does not guarantee restoration success/);
});

test("preview uses deterministic baselines for cases, folders, and quick captures", () => {
  const snapshot = { cases: [currentCase()], folders: [{ id: "folder-1", name: "One" }], quickCaptures: [{ id: "capture-1", text: "One" }] };
  const baseline = createImportPreviewBaseline(snapshot);
  assert.equal(matchesImportPreviewBaseline(baseline, snapshot), true);
  assert.equal(matchesImportPreviewBaseline(baseline, { ...snapshot, folders: [{ id: "folder-1", name: "Changed" }] }), false);
  assert.equal(matchesImportPreviewBaseline(baseline, { ...snapshot, quickCaptures: [{ id: "capture-1", text: "Changed" }] }), false);
  assert.equal(matchesImportPreviewBaseline(baseline, { ...snapshot, cases: [currentCase({ description: "Changed" })] }), false);
});

test("preview is deterministic, serialisable, and leaves parsed payload and snapshot untouched", () => {
  const payload = fullBackup();
  const snapshot = { cases: [currentCase()], folders: [{ id: "folder-1", name: "Current" }], quickCaptures: [] };
  const payloadBefore = JSON.stringify(payload);
  const snapshotBefore = JSON.stringify(snapshot);
  const first = buildImportPreview(payload, snapshot);
  const second = buildImportPreview(payload, snapshot);
  assert.deepEqual(first, second);
  assert.doesNotThrow(() => JSON.stringify(first));
  assert.equal(JSON.stringify(payload), payloadBefore);
  assert.equal(JSON.stringify(snapshot), snapshotBefore);
});
