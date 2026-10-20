import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const css = readFileSync(new URL("../../index.css", import.meta.url), "utf8");
const goals = readFileSync(new URL("./GoalWorkspace.jsx", import.meta.url), "utf8");
const ledger = readFileSync(new URL("./LedgerTab.jsx", import.meta.url), "utf8");

test("Goal and Ledger opt into the shared scoped action compatibility layer", () => {
  assert.match(goals, /case-file-strategy-goals case-file-goals/);
  assert.match(ledger, /className="case-file-ledger space-y-5"/);
  assert.match(css, /\.case-file-goals, \.case-file-ledger\) button:is\(\.border-lime-500, \.bg-lime-600\)/);
  assert.match(css, /background: #0f766e;/);
  assert.match(css, /background: #115e59;/);
  assert.match(css, /background: #172554;/);
  assert.match(css, /background: #1e3a5f;/);
  assert.match(css, /background: #7f1d1d;/);
  assert.match(css, /background: #991b1b;/);
});

test("Goal and Ledger selection and focus treatments use teal without altering financial status tones", () => {
  assert.match(goals, /case-file-goal-focus/);
  assert.match(goals, /case-file-goal-draft/);
  assert.match(goals, /case-file-goal-card/);
  assert.match(css, /\.case-file-goals :is\(.case-file-goal-focus, .case-file-goal-draft, .case-file-goal-card\[data-focused="true"\]\)/);
  assert.match(ledger, /focus-visible:ring-\[#2dd4bf\]/);
  assert.match(ledger, /bg-\[#f0fdfa\]/);
  assert.match(ledger, /const statusTone = \{ paid: "bg-lime-100 text-lime-700 border-lime-300"/);
  assert.match(ledger, /const proofTone = \{ confirmed: "bg-lime-100 text-lime-700 border-lime-300"/);
});

test("Goal and Ledger action callbacks remain on their original operations", () => {
  assert.match(goals, /onClick=\{beginCreate\}/);
  assert.match(goals, /onClick=\{save\}/);
  assert.match(goals, /onClick=\{remove\}/);
  assert.match(ledger, /onClick=\{\(\) => onOpenLedgerModal\(\)\}/);
  assert.match(ledger, /onClick=\{\(\) => onDuplicateLedgerEntry\(selectedEntry\)\}/);
  assert.match(ledger, /onClick=\{\(\) => onDeleteLedgerEntry\(selectedEntry\.id\)\}/);
});
