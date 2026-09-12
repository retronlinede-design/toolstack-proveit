import test from "node:test";
import assert from "node:assert/strict";
import { preflightBackupPayload, validateStoredCaseForNormalization } from "./importPreflight.js";

const caseItem = { id: "case-1", name: "Case", incidents: [], evidence: [], documents: [], ledger: [], strategy: [], watchItems: [], tasks: [], parties: [], issues: [] };
const current = () => ({ app: "proveit", contractVersion: "2.0", exportType: "FULL_BACKUP_CASE", data: { cases: [caseItem] } });

test("preflight accepts the current backup contract and supported unversioned legacy shape", () => {
  assert.equal(preflightBackupPayload(current()).ok, true);
  assert.equal(preflightBackupPayload({ cases: [caseItem] }).ok, true);
  assert.equal(preflightBackupPayload({ type: "FULL_BACKUP", version: "2.1-full-backup", data: { cases: [caseItem] } }).ok, true);
  assert.equal(preflightBackupPayload({ includesBinaryData: true, cases: [caseItem] }).isFullBackup, true);
});

test("preflight rejects malformed and future envelopes before restore work", () => {
  assert.match(preflightBackupPayload({ app: "proveit", contractVersion: "3.0", exportType: "FULL_BACKUP_CASE", data: { cases: [caseItem] } }).reason, /Unsupported ProveIt backup contract version/);
  assert.match(preflightBackupPayload({ app: "proveit", contractVersion: "2.0", exportType: "FULL_BACKUP_CASE", data: { cases: [{}] } }).reason, /id is required/);
  assert.match(preflightBackupPayload({ data: { cases: "not-an-array" } }).reason, /data\.cases/);
  assert.match(preflightBackupPayload({ type: "FULL_BACKUP", version: "9.0", data: { cases: [caseItem] } }).reason, /Unsupported legacy backup version/);
});

test("preflight permits sparse patches only for an existing case and does not default unknown shapes", () => {
  assert.equal(preflightBackupPayload({ cases: [{ id: "case-1", evidence: [{ id: "evidence-1" }] }] }, { existingCaseIds: ["case-1"] }).ok, true);
  assert.match(preflightBackupPayload({ cases: [{ id: "new-case" }] }).reason, /name or title/);
  assert.match(preflightBackupPayload({ cases: [{ id: "case-1", evidence: {} }] }, { existingCaseIds: ["case-1"] }).reason, /must be an array/);
  assert.equal(validateStoredCaseForNormalization({ id: "stored", name: "Stored", evidence: [] }).ok, true);
  assert.equal(validateStoredCaseForNormalization({ id: "stored" }).ok, false);
  assert.equal(validateStoredCaseForNormalization({ id: "stored", name: "Stored", evidence: [{}] }).ok, false);
});
