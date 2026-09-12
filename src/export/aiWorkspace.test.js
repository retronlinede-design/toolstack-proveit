import test from "node:test";
import assert from "node:assert/strict";
import { buildAiWorkspaceCurrentCase, buildAiWorkspaceManifest } from "./aiWorkspace.js";

const caseItem = {
  id: "case-1", revision: 12, name: "Finkenweg Housing", privacyLock: { pin: "1234" },
  incidents: [], evidence: [], documents: [], ledger: [], strategy: [], watchItems: [], parties: [],
  actionSummary: {},
};

test("AI Workspace snapshot wraps the existing V3 reasoning projection with revision-safe metadata", () => {
  const snapshot = buildAiWorkspaceCurrentCase(caseItem, { exportedAt: "2026-09-12T12:00:00.000Z" });
  assert.deepEqual(Object.keys(snapshot), ["workspaceFormat", "workspaceVersion", "caseId", "baseRevision", "exportedAt", "snapshotFile", "snapshotPurpose", "importableAsBackup", "includesBinaryData", "projectionContractVersion", "projection"]);
  assert.equal(snapshot.caseId, "case-1"); assert.equal(snapshot.baseRevision, 12);
  assert.equal(snapshot.importableAsBackup, false); assert.equal(snapshot.includesBinaryData, false);
  assert.equal(snapshot.projection.contractVersion, "reasoning-export-3.0");
  assert.equal(JSON.stringify(snapshot).includes("1234"), false);
});

test("AI Workspace manifest stays metadata-only and uses the initial revision for legacy cases", () => {
  const manifest = buildAiWorkspaceManifest({ ...caseItem, revision: undefined }, { exportedAt: "2026-09-12T12:00:00.000Z" });
  assert.equal(manifest.baseRevision, 1);
  assert.equal(Object.hasOwn(manifest, "projection"), false);
  assert.equal(manifest.snapshotFile, "CURRENT_CASE.json");
});
