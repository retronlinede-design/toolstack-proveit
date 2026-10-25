import assert from "node:assert/strict";
import test from "node:test";

import { preflightBackupPayload, validateBackupReportLibraryIntegrity } from "../backup/importPreflight.js";
import { buildFullBackupCasePayload, restoreFullBackupCase } from "../backup/fullBackup.js";
import { mergeCase, normalizeCase } from "../domain/caseDomain.js";
import { normalizeStoredCase } from "../domain/caseNormalization.js";
import { saveCaseToDb } from "../storage.js";
import { calculateReportRevisionChecksum, REPORT_CHECKSUM_FORMAT } from "./reportLifecycle.js";
import {
  classifyReportLibrary,
  mergeReportLibraries,
  ReportLibraryConflictError,
  validateReportLibraryIntegrity,
} from "./reportLibrary.js";

const TIME = "2026-10-25T12:00:00.000Z";

async function library(overrides = {}) {
  const revision = {
    schemaVersion: 1, id: "revision-1", reportId: "report-1", versionNumber: 1, parentRevisionId: null,
    createdAt: TIME, source: { caseRevision: 2, fingerprint: "fnv1a-source" },
    content: { schemaVersion: 1, report: { title: "Report" }, sections: [{ id: "summary", items: ["Synthetic"] }] },
    generationMode: "deterministic", provenance: { citations: [], claims: [] },
    contentChecksum: REPORT_CHECKSUM_FORMAT + ":" + "0".repeat(64),
    lifecycle: { status: "draft", updatedAt: TIME, review: {} },
  };
  revision.contentChecksum = await calculateReportRevisionChecksum(revision);
  return {
    schemaVersion: 1,
    reports: {
      "report-1": {
        schemaVersion: 1, id: "report-1", caseId: "case-1", reportType: "investigation",
        scope: { type: "issue", issueId: "retired-issue-id", issueReference: "ISS-001", issueName: "Historic issue" },
        title: "Report", createdAt: TIME, currentRevisionId: "revision-1", approvedRevisionId: null,
        revisionIds: ["revision-1"], status: "draft",
      },
    },
    revisions: { "revision-1": revision },
    ...overrides,
  };
}

function memoryDb(initial = []) {
  const cases = new Map(initial.map((item) => [item.id, structuredClone(item)]));
  const images = new Map();
  return {
    cases,
    transaction() {
      return {
        objectStore(name) {
          const store = name === "cases" ? cases : images;
          return {
            get: async (id) => structuredClone(store.get(id)),
            getAll: async () => [...store.values()].map((item) => structuredClone(item)),
            put: async (item) => store.set(item.id, structuredClone(item)),
            delete: async (id) => store.delete(id),
          };
        },
        done: Promise.resolve(),
        abort() {},
      };
    },
  };
}

test("report library validates maps, ownership, lifecycle consistency, and immutable checksums", async () => {
  const valid = await library();
  assert.deepEqual(classifyReportLibrary(valid, { caseId: "case-1" }), { kind: "supported", valid: true, errors: [] });
  assert.deepEqual(await validateReportLibraryIntegrity(valid, { caseId: "case-1" }), { kind: "supported", valid: true, errors: [] });

  const invalid = structuredClone(valid);
  invalid.revisions["revision-1"].content.sections[0].items.push("Tampered");
  assert.equal((await validateReportLibraryIntegrity(invalid, { caseId: "case-1" })).valid, false);
  assert.equal(classifyReportLibrary({ ...valid, reports: { wrong: valid.reports["report-1"] } }, { caseId: "case-1" }).valid, false);
  assert.equal(classifyReportLibrary({ ...valid, reports: { "report-1": { ...valid.reports["report-1"], caseId: "other-case" } } }, { caseId: "case-1" }).valid, false);
});

test("normalization preserves valid, future, and malformed report libraries without creating one", async () => {
  const valid = await library();
  const caseItem = { id: "case-1", name: "Case", reportLibrary: valid };
  assert.deepEqual(normalizeCase(caseItem).reportLibrary, valid);
  assert.deepEqual(normalizeStoredCase(caseItem).reportLibrary, valid);
  assert.equal(Object.hasOwn(normalizeCase({ id: "case-1", name: "Case" }), "reportLibrary"), false);
  const future = { schemaVersion: 2, reports: { opaque: { retained: true } }, revisions: {} };
  assert.deepEqual(normalizeCase({ id: "case-1", name: "Case", reportLibrary: future }).reportLibrary, future);
  const malformed = { schemaVersion: 1, reports: {}, revisions: { bad: {} } };
  assert.deepEqual(normalizeStoredCase({ id: "case-1", name: "Case", reportLibrary: malformed }).reportLibrary, malformed);
});

test("imports fail closed for malformed or future libraries before integrity work", async () => {
  const valid = await library();
  const payload = { app: "proveit", contractVersion: "2.0", exportType: "FULL_BACKUP_CASE", data: { cases: [{ id: "case-1", name: "Case", reportLibrary: valid }] } };
  assert.equal(preflightBackupPayload(payload, { existingCaseIds: ["case-1"] }).ok, true);
  assert.equal((await validateBackupReportLibraryIntegrity(payload.data)).ok, true);

  const future = structuredClone(payload);
  future.data.cases[0].reportLibrary.schemaVersion = 2;
  assert.match(preflightBackupPayload(future, { existingCaseIds: ["case-1"] }).reason, /unsupported future schema/i);
  const binary = structuredClone(payload);
  binary.data.cases[0].reportLibrary.revisions["revision-1"].content.dataUrl = "data:text/plain,not-allowed";
  assert.match(preflightBackupPayload(binary, { existingCaseIds: ["case-1"] }).reason, /reportLibrary is invalid/i);
});

test("report-library merge is additive only and rejects immutable, lifecycle, pointer, and orphan conflicts", async () => {
  const local = await library();
  assert.deepEqual(mergeReportLibraries(local, undefined, { caseId: "case-1" }), local);
  assert.deepEqual(mergeReportLibraries(undefined, local, { caseId: "case-1" }), local);
  assert.deepEqual(mergeReportLibraries(local, structuredClone(local), { caseId: "case-1" }), local);

  const additive = structuredClone(local);
  const second = {
    ...additive.revisions["revision-1"],
    id: "revision-2",
    versionNumber: 2,
    parentRevisionId: "revision-1",
    createdAt: "2026-10-26T12:00:00.000Z",
    content: { schemaVersion: 1, report: { title: "Report" }, sections: [{ id: "summary", items: ["Updated"] }] },
  };
  second.contentChecksum = await calculateReportRevisionChecksum(second);
  additive.revisions = { "revision-2": second };
  additive.reports["report-1"].revisionIds = ["revision-1", "revision-2"];
  const merged = mergeReportLibraries(local, additive, { caseId: "case-1" });
  assert.deepEqual(merged.reports["report-1"].revisionIds, ["revision-1", "revision-2"]);
  assert.equal(merged.revisions["revision-2"].parentRevisionId, "revision-1");

  const checksumConflict = structuredClone(local);
  checksumConflict.revisions["revision-1"].contentChecksum = REPORT_CHECKSUM_FORMAT + ":" + "a".repeat(64);
  assert.throws(() => mergeReportLibraries(local, checksumConflict, { caseId: "case-1" }), ReportLibraryConflictError);
  const lifecycleConflict = structuredClone(local);
  lifecycleConflict.revisions["revision-1"].lifecycle.updatedAt = "2026-10-26T12:00:00.000Z";
  assert.throws(() => mergeReportLibraries(local, lifecycleConflict, { caseId: "case-1" }), ReportLibraryConflictError);
  const pointerConflict = structuredClone(local);
  pointerConflict.reports["report-1"].currentRevisionId = "missing";
  pointerConflict.reports["report-1"].revisionIds = ["missing"];
  assert.throws(() => mergeReportLibraries(local, pointerConflict, { caseId: "case-1" }), ReportLibraryConflictError);
});

test("generic case imports delegate report history to the strict merge boundary and retain old backups without libraries", async () => {
  const valid = await library();
  const local = normalizeCase({ id: "case-1", name: "Case", reportLibrary: valid, evidence: [] });
  const preserved = mergeCase(local, { id: "case-1", notes: "Legacy backup omitted reports" });
  assert.deepEqual(preserved.reportLibrary, valid);
  const conflict = structuredClone(valid);
  conflict.revisions["revision-1"].contentChecksum = REPORT_CHECKSUM_FORMAT + ":" + "b".repeat(64);
  assert.throws(() => mergeCase(local, { id: "case-1", reportLibrary: conflict }), ReportLibraryConflictError);
});

test("full backups retain report history and the storage gate rejects a tampered direct save", async () => {
  const valid = await library();
  const caseItem = normalizeCase({ id: "case-1", name: "Case", revision: 1, reportLibrary: valid, evidence: [] });
  const backup = await buildFullBackupCasePayload({ caseItem });
  assert.deepEqual(backup.data.cases[0].reportLibrary, valid);
  assert.deepEqual((await restoreFullBackupCase(backup.data.cases[0], { addImage: async () => {}, generateId: () => "unused" })).reportLibrary, valid);

  const db = memoryDb([caseItem]);
  const validUpdate = { ...caseItem, notes: "Routine update" };
  await saveCaseToDb(db, validUpdate);
  assert.deepEqual(db.cases.get("case-1").reportLibrary, valid);
  const tampered = structuredClone(validUpdate);
  tampered.revision = validUpdate.revision;
  tampered.reportLibrary.revisions["revision-1"].content.sections[0].items.push("Tampered");
  await assert.rejects(saveCaseToDb(db, tampered), /report library is invalid/i);
  assert.deepEqual(db.cases.get("case-1").reportLibrary, valid);
});

test("storage preserves an existing future-schema library for ordinary saves and blocks edits", async () => {
  const future = { schemaVersion: 2, reports: { opaque: { future: true } }, revisions: {} };
  const original = normalizeCase({ id: "case-1", name: "Case", revision: 1, reportLibrary: future });
  const db = memoryDb([original]);
  const ordinaryUpdate = { id: "case-1", name: "Case changed", revision: 1 };
  await saveCaseToDb(db, ordinaryUpdate);
  assert.deepEqual(db.cases.get("case-1").reportLibrary, future);
  const changedFuture = { ...ordinaryUpdate, revision: ordinaryUpdate.revision, reportLibrary: { ...future, revisions: { altered: true } } };
  await assert.rejects(saveCaseToDb(db, changedFuture), /Unsupported or malformed report library cannot be changed/i);
});
