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

test("document cards preserve ordered actions through RecordActions", () => {
  assert.match(source, /import RecordActions from "\.\.\/shared\/RecordActions\.jsx"/);
  assert.match(source, /key: "open", label: "Open Document", variant: "primary", onClick: \(\) => onOpenDocument\(doc\)/);
  assert.match(source, /key: "edit", label: "Edit", onClick: \(\) => onOpenDocument\(doc\)/);
  assert.match(source, /key: "convert", label: "Convert", variant: "secondary", onClick: \(\) => onConvertDocument\?\.\(doc\)/);
  assert.match(source, /key: "delete", label: "Delete", variant: "danger", onClick: \(\) => onDeleteDocument\(doc\)/);
  assert.match(source, /flex-wrap items-center gap-2 sm:flex-nowrap/);
});
