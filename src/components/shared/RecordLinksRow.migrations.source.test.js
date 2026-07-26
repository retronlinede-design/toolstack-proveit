import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const strategy = readFileSync(new URL("../StrategyRecordCard.jsx", import.meta.url), "utf8");
const watch = readFileSync(new URL("../caseDetail/WatchItemCard.jsx", import.meta.url), "utf8");
const documents = readFileSync(new URL("../caseDetail/DocumentsTab.jsx", import.meta.url), "utf8");
const parties = readFileSync(new URL("../caseDetail/PartiesTab.jsx", import.meta.url), "utf8");

test("only the four approved cards migrate through the shared relationship component", () => {
  for (const source of [strategy, watch, documents, parties]) {
    assert.match(source, /import RecordLinksRow/);
    assert.match(source, /<RecordLinksRow/);
    assert.match(source, /RecordMetadataRow/);
    assert.match(source, /RecordBadge/);
    assert.match(source, /RecordActions/);
  }
});

test("Strategy preserves sequence counts linked disclosure handlers and attachment preview", () => {
  assert.match(strategy, /key: "sequence-group"/);
  assert.match(strategy, /countBadges\.map/);
  assert.match(strategy, /missingLinkedRecordCount/);
  assert.match(strategy, /View linked records \(\{linkedRecords\.length\}\)/);
  assert.match(strategy, /onClick: \(\) => openLinkedRecord\?\.\(record\.id\)/);
  assert.match(strategy, /render: <AttachmentPreview attachments=\{item\.attachments\} imageCache=\{imageCache\} onPreview=\{onPreviewFile\}/);
});

test("Watch moves true relationships out of metadata without changing counts", () => {
  for (const key of ["sequence-group", "linked-records", "related-people", "attachments"]) assert.match(watch, new RegExp(`key: "${key}"`));
  assert.match(watch, /item\.linkedRecordIds\.length === links\.length/);
  assert.match(watch, /missing link/);
  const metadataBlock = watch.slice(watch.indexOf("<RecordMetadataRow"), watch.indexOf("<RecordLinksRow"));
  assert.doesNotMatch(metadataBlock, /sequence-group|linked-records|related-people|attachments/);
});

test("Documents preserves link attachment and party behavior with explicit missing items", () => {
  assert.match(documents, /onClick: \(\) => onOpenLinkedRecord\(id\)/);
  assert.match(documents, /onPreview=\{onPreviewFile\}/);
  assert.match(documents, /missingRecordLinkCount/);
  assert.match(documents, /missingPartyLinkCount/);
  assert.match(documents, /key: "sequence-group"/);
  assert.doesNotMatch(documents, /renderCompactLinkRow|<LinkedChip|<PartyLinksRow/);
});

test("Parties migrates relationship prose but keeps contact fields in metadata", () => {
  assert.match(parties, /key: "relationship-to-case"/);
  assert.match(parties, /label: party\.relationshipToCase/);
  for (const key of ["job-title", "department", "organisation", "email", "phone", "website"]) assert.match(parties, new RegExp(`key: "${key}"`));
});
