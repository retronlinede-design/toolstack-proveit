import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("src/components/caseDetail/LedgerTab.jsx", "utf8");

test("ledger entries render linked party chips", () => {
  assert.match(source, /import PartyLinksRow from "\.\/PartyLinksRow"/);
  assert.match(source, /parties = \[\]/);
  assert.match(source, /<PartyLinksRow linkedPartyIds=\{item\.linkedPartyIds\} parties=\{parties\} \/>/);
});
