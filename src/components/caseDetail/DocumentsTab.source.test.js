import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("src/components/caseDetail/DocumentsTab.jsx", "utf8");

test("document cards render linked party relationships", () => {
  assert.match(source, /import RecordLinksRow from "\.\.\/shared\/RecordLinksRow\.jsx"/);
  assert.match(source, /parties = \[\]/);
  assert.match(source, /key: "linked-parties"/);
  assert.match(source, /partyItems/);
  assert.match(source, /missingPartyCount/);
});

test("document cards use text-readiness and type badges without verification claims", () => {
  assert.match(source, /import RecordBadge from "\.\.\/shared\/RecordBadge\.jsx"/);
  assert.match(source, /readinessVariant\(textStatus\)/);
  assert.match(source, /readinessLabel\(textStatus\)/);
  assert.match(source, /variant="type"/);
  assert.doesNotMatch(source, /verification-verified/);
});

test("document cards preserve ordered actions through RecordActions", () => {
  assert.match(source, /import RecordActions from "\.\.\/shared\/RecordActions\.jsx"/);
  assert.match(source, /key: "open", label: "Open"/);
  assert.match(source, /key: "edit", label: "Edit"/);
  assert.match(source, /key: "convert", label: "Convert"/);
  assert.match(source, /key: "delete", label: "Delete"/);
  assert.match(source, /Open document \$\{title\}/);
  assert.match(source, /Delete document \$\{title\}/);
  assert.match(source, /case-file-document-actions/);
});

test("Documents has a scoped compact filter interface that preserves stored order", () => {
  for (const className of ["case-file-documents", "case-file-documents-header", "case-file-documents-controls", "case-file-document-card"]) assert.match(source, new RegExp(className));
  assert.match(source, /useState\(""\)/);
  assert.match(source, /issueFilter/);
  assert.match(source, /categoryFilter/);
  assert.match(source, /readinessFilter/);
  assert.match(source, /const filteredDocuments = documents\.filter/);
});

test("Documents cards expose accessible expanded details and qualified text readiness", () => {
  assert.match(source, /aria-expanded=\{expanded\}/);
  assert.match(source, /aria-controls=\{detailId\}/);
  assert.match(source, /Show document details/);
  assert.match(source, /Hide document details/);
  assert.match(source, /Captured text: ready/);
  assert.match(source, /Captured text: partial/);
  assert.match(source, /Captured text: not available/);
  assert.doesNotMatch(source, /verification-verified/);
});

test("Documents retains direct relationships and attachment previews without availability claims", () => {
  assert.match(source, /Attachment records/);
  assert.match(source, /Linked Case Items/);
  assert.match(source, /Linked Parties/);
  assert.match(source, /onOpenLinkedRecord\(id\)/);
  assert.match(source, /attachments=\{doc\.attachments\} imageCache=\{imageCache\} onPreview=\{onPreviewFile\}/);
});
