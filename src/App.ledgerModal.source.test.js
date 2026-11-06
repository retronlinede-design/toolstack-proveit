import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync("src/App.jsx", "utf8");

test("Ledger editor uses DialogShell with the shared accessible modal boundary", () => {
  assert.match(source, /\{ledgerModalOpen && \(\s*<DialogShell/);
  assert.match(source, /title=\{editingLedgerId \? "Edit Ledger Entry" : "Add Ledger Entry"\}/);
  assert.match(source, /dismissOnBackdrop=\{false\}/);
  assert.match(source, /initialFocusRef=\{ledgerLabelInputRef\}/);
  assert.match(source, /footer=\{ledgerModalFooter\}/);
});

test("Ledger editor baselines normal and duplicate sessions across the full form", () => {
  const baselineAssignments = source.match(/ledgerFormFingerprintRef\.current = JSON\.stringify\(nextLedgerForm\)/g) || [];
  assert.equal(baselineAssignments.length, 2);
  assert.match(source, /ledgerFormFingerprintRef\.current !== JSON\.stringify\(ledgerForm\)/);
  assert.match(source, /Discard unsaved changes\?/);
  assert.match(source, /key=\{`\$\{selectedCaseId\}:\$\{editingLedgerId \|\| "new"\}`\}/);
});

test("Ledger modal retains its established financial and relationship fields and save boundary", () => {
  for (const field of ["expectedAmount", "paidAmount", "paymentDate", "status", "proofStatus", "linkedRecordIds", "linkedPartyIds"]) {
    assert.match(source, new RegExp(`ledgerForm\\.${field}`));
  }
  assert.match(source, /upsertLedgerEntryInCase\(currentCase, ledgerForm, editingLedgerId\)/);
  assert.match(source, /closeLedgerModal\(\);/);
});

test("Ledger editor offers ordinary and tracking-record Documents through the existing linkedRecordIds selector", () => {
  assert.match(source, /\.\.\.\(selectedCase\?\.documents \|\| \[\]\)\.map\(r => \(\{ \.\.\.r, _type: 'documents', _label: 'Document' \}\)\)/);
  assert.match(source, /ledgerForm\.linkedRecordIds \|\| \[\]\)\.includes\(rec\.id\)/);
  assert.match(source, /\? \[\.\.\.\(prev\.linkedRecordIds \|\| \[\]\), rec\.id\]/);
  assert.match(source, /: \(prev\.linkedRecordIds \|\| \[\]\)\.filter\(id => id !== rec\.id\)/);
  assert.match(source, /!selectedCase\?\.documents\?\.length/);
});

test("successful Ledger saves retain their direct close path without a dismissal warning", () => {
  const saveStart = source.indexOf("  const saveLedgerEntry = async () => {");
  const saveEnd = source.indexOf("\n  const relatedTrackingRecordsForViewing", saveStart);
  const saveSource = source.slice(saveStart, saveEnd);
  assert.match(saveSource, /closeLedgerModal\(\);/);
  assert.doesNotMatch(saveSource, /requestCloseLedgerModal/);
});
