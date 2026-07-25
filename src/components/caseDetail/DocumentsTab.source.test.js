import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("src/components/caseDetail/DocumentsTab.jsx", "utf8");

test("document cards render linked party chips", () => {
  assert.match(source, /import PartyLinksRow from "\.\/PartyLinksRow"/);
  assert.match(source, /parties = \[\]/);
  assert.match(source, /<PartyLinksRow linkedPartyIds=\{doc\.linkedPartyIds\} parties=\{parties\} \/>/);
});

test("document cards use semantic verification and type badges", () => {
  assert.match(source, /import RecordBadge from "\.\.\/shared\/RecordBadge\.jsx"/);
  assert.match(source, /getDocumentStatusBadgeVariant\(textStatus\.tone\)/);
  assert.match(source, /variant="type"/);
  assert.doesNotMatch(source, /getDocumentStatusClasses/);
});
