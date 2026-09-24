import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("src/components/caseDetail/LedgerTab.jsx", "utf8");

test("Ledger tab presents existing entries in a selectable table and keeps linked details available", () => {
  assert.match(source, /Date \/ Period/);
  assert.match(source, /Expected/);
  assert.match(source, /Paid/);
  assert.match(source, /Difference/);
  assert.match(source, /Selected entry/);
  assert.match(source, /onClick=\{\(\) => selectRow\(entry\.id\)\}/);
  assert.match(source, /onOpenLedgerModal\(selectedEntry, selectedEntry\.id\)/);
  assert.match(source, /filterLedgerEntries\(entries, ledgerFilter\)/);
  assert.match(source, /import PartyLinksRow from "\.\/PartyLinksRow"/);
  assert.match(source, /parties = \[\]/);
  assert.match(source, /<PartyLinksRow linkedPartyIds=\{selectedEntry\.linkedPartyIds\} parties=\{parties\} \/>/);
});
