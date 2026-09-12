import test from "node:test";
import assert from "node:assert/strict";
import { normalizeCase, normalizeActionSummary } from "./caseDomain.js";
import { buildCaseReasoningExportV3Payload } from "../export/reasoningExportV3.js";
import { normalizeNextActions, projectNextActionTexts } from "./nextActions.js";
import { actionSummaryToForm, formToActionSummary, applyActionSummaryPatch } from "../components/caseDetail/actionSummaryHelpers.js";
import { mergeImportedCases } from "./caseImport.js";
import { buildFullBackupAllPayload, restoreFullBackupCase } from "../backup/fullBackup.js";
import { preflightBackupPayload } from "../backup/importPreflight.js";
import { buildAiWorkspaceCurrentCase } from "../export/aiWorkspace.js";
import { saveCaseToDb, CaseRevisionConflictError } from "../storage.js";
import { ingestGptDelta } from "../gpt/gptDelta.js";

const action = { id: "action-1", text: "Send evidence", completed: true, completedAt: "2026-09-01T00:00:00.000Z", dueDate: "2026-08-31", priority: "high" };
const source = () => ({ id: "audit-015", name: "Synthetic case", revision: 7, createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-01T00:00:00.000Z", actionSummary: { nextActions: [structuredClone(action)] } });

test("AUDIT-015: canonical action metadata survives repeated case normalization", () => {
  const result = normalizeCase(normalizeCase(source()));
  assert.deepEqual(result.actionSummary.nextActions, [action]);
});

test("AUDIT-015: v3 projects structured nextActions as text without emptying or mutating them", () => {
  const input = source(); const before = structuredClone(input);
  const exported = buildCaseReasoningExportV3Payload(input);
  assert.deepEqual(exported.case.actionSummary.nextActions, [action.text]);
  assert.deepEqual(input, before);
});

test("AUDIT-015: unsupported action objects remain intact in canonical normalization", () => {
  const unsupported = { instruction: "Historical shape", metadata: { keep: true } };
  assert.deepEqual(normalizeActionSummary({ nextActions: [unsupported] }).nextActions, [unsupported]);
});

test("AUDIT-015: legacy strings and mixed structured actions normalize without losing metadata", () => {
  const result = normalizeNextActions([" Legacy ", action]);
  assert.deepEqual(result, [{ text: "Legacy", completed: false, completedAt: null }, action]);
  assert.deepEqual(projectNextActionTexts(result), ["Legacy", action.text]);
});

test("AUDIT-015: unsupported objects fail v3 and AI Workspace projection explicitly", () => {
  for (const unsupported of [{ title: "Unknown shape" }, { text: { nested: "Not a string" } }, { text: "" }, ["Unexpected nested list"], new Date("2026-09-01")]) {
    const input = source(); input.actionSummary.nextActions = [unsupported];
    const before = structuredClone(input);
    assert.throws(() => buildCaseReasoningExportV3Payload(input), /Cannot project nextActions\[0\]/);
    assert.throws(() => buildAiWorkspaceCurrentCase(input), /Cannot project nextActions\[0\]/);
    assert.deepEqual(normalizeCase(input).actionSummary.nextActions, [unsupported]);
    assert.deepEqual(input, before);
  }
});

test("AUDIT-015: UI patch normalization preserves action IDs and scheduling metadata", () => {
  const summary = { nextActions: [action], currentFocus: "Old" };
  const result = applyActionSummaryPatch(summary, { currentFocus: "New" });
  assert.deepEqual(result.nextActions, [action]);
  assert.equal(result.currentFocus, "New");
});

test("AUDIT-015: text-form round trip preserves active, completed and opaque objects", () => {
  const active = { ...action, completed: false, completedAt: null };
  const opaque = { instruction: "Keep unsupported history" };
  const summary = normalizeActionSummary({ nextActions: [action, active, opaque], updatedAt: "2026-09-01" });
  const form = actionSummaryToForm(summary);
  const result = formToActionSummary(form, summary);
  assert.deepEqual(result, summary);
  const edited = formToActionSummary({ ...form, nextActions: `${active.text}\nNew action` }, summary);
  assert.deepEqual(edited.nextActions[0], active);
  assert.ok(edited.nextActions.some((item) => item.id === action.id && item.completed));
  assert.ok(edited.nextActions.some((item) => item.instruction === opaque.instruction));
});

test("AUDIT-015: duplicate display text does not erase distinct action metadata in the form", () => {
  const first = { ...action, id: "first", completed: false, completedAt: null };
  const second = { ...first, id: "second", priority: "low" };
  const summary = { nextActions: [first, second] };
  const form = actionSummaryToForm(summary);
  const result = formToActionSummary({ ...form, nextActions: `${form.nextActions}\nAnother` }, summary);
  assert.deepEqual(result.nextActions.slice(0, 2), [first, second]);
});

test("AUDIT-015: sparse import retains structured actions; explicit mixed arrays normalize as supplied", () => {
  const existing = normalizeCase(source());
  const sparse = mergeImportedCases([existing], [{ id: existing.id, actionSummary: { currentFocus: "Imported focus" } }]).mergedCases[0];
  assert.deepEqual(sparse.actionSummary.nextActions, [action]);
  const mixed = mergeImportedCases([existing], [{ id: existing.id, actionSummary: { nextActions: ["Legacy", action] } }]).mergedCases[0];
  assert.deepEqual(mixed.actionSummary.nextActions, [{ text: "Legacy", completed: false, completedAt: null }, action]);
  const legacyLocal = normalizeCase({ ...source(), actionSummary: { nextActions: ["Legacy local"] } });
  const structuredIncoming = mergeImportedCases([legacyLocal], [{ id: existing.id, actionSummary: { nextActions: [action] } }]).mergedCases[0];
  assert.deepEqual(structuredIncoming.actionSummary.nextActions, [action]);
});

test("AUDIT-015: backup preflight, restore and import preserve structured and opaque action payloads", async () => {
  const input = normalizeCase(source());
  input.actionSummary.nextActions.push({ historicalAction: { text: "Opaque history" } });
  const payload = JSON.parse(JSON.stringify(await buildFullBackupAllPayload({ cases: [input] })));
  const preflight = preflightBackupPayload(payload, { existingCaseIds: [input.id] });
  assert.equal(preflight.ok, true);
  const restored = await restoreFullBackupCase(preflight.data.cases[0]);
  const merged = mergeImportedCases([input], [restored]).mergedCases[0];
  assert.deepEqual(merged.actionSummary.nextActions, input.actionSummary.nextActions);
  assert.equal(preflightBackupPayload({ ...payload, contractVersion: "unsupported" }).ok, false);
});

test("AUDIT-015: AI Workspace retains its action allowlist and baseRevision without changing state", () => {
  const input = normalizeCase(source()); const before = structuredClone(input);
  input.actionSummary.nextActions[0].backupDataUrl = "excluded-private-bytes";
  const workspace = buildAiWorkspaceCurrentCase(input);
  assert.equal(workspace.baseRevision, 7);
  assert.deepEqual(workspace.projection.canonical.actionSummary.nextActions, [{ id: action.id, text: action.text, completed: true, completedAt: action.completedAt }]);
  assert.doesNotMatch(JSON.stringify(workspace), /excluded-private-bytes/);
  assert.deepEqual(input.actionSummary.nextActions[0], { ...before.actionSummary.nextActions[0], backupDataUrl: "excluded-private-bytes" });
});

test("AUDIT-015: normalized no-op saves preserve revision; material edits retain stale-write protection", async () => {
  let stored = normalizeCase(source());
  const db = { async get() { return structuredClone(stored); }, async put(_store, value) { stored = structuredClone(value); } };
  const read = normalizeCase(await db.get());
  const form = actionSummaryToForm(read.actionSummary);
  read.actionSummary = formToActionSummary(form, read.actionSummary);
  await saveCaseToDb(db, read);
  assert.equal(read.revision, 7);
  assert.deepEqual(stored.actionSummary.nextActions, [action]);
  const stale = structuredClone(read);
  read.actionSummary.currentFocus = "Material change";
  await saveCaseToDb(db, read);
  assert.equal(read.revision, 8);
  assert.equal(buildAiWorkspaceCurrentCase(read).baseRevision, 8);
  await assert.rejects(saveCaseToDb(db, stale), CaseRevisionConflictError);
  assert.deepEqual(stored.actionSummary.nextActions, [action]);
});

test("AUDIT-015: GPT v3 unrelated patches preserve canonical actions; legacy action contract rejects objects explicitly", () => {
  const input = normalizeCase({ ...source(), strategy: [{ id: "s", title: "Strategy" }] });
  const result = ingestGptDelta(input, { app: "proveit", contractVersion: "gpt-delta-3.0", target: { caseId: input.id, baseRevision: 7 }, operations: { patch: { strategy: [{ id: "s", patch: { title: "Updated" } }] } } });
  assert.equal(result.ok, true, result.reason);
  assert.deepEqual(result.case.actionSummary.nextActions, [action]);
  const invalid = ingestGptDelta(input, { app: "proveit", contractVersion: "gpt-delta-1.0", target: { caseId: input.id, baseRevision: 7 }, operations: { patch: { actionSummary: { nextActions: [action] } } } });
  assert.equal(invalid.ok, false);
  assert.match(invalid.reason, /only strings/);
});
