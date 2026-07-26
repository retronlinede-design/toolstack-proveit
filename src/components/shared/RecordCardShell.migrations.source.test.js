import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const strategy = readFileSync(new URL("../StrategyRecordCard.jsx", import.meta.url), "utf8");
const watch = readFileSync(new URL("../caseDetail/WatchItemCard.jsx", import.meta.url), "utf8");
const documents = readFileSync(new URL("../caseDetail/DocumentsTab.jsx", import.meta.url), "utf8");
const parties = readFileSync(new URL("../caseDetail/PartiesTab.jsx", import.meta.url), "utf8");
const incident = readFileSync(new URL("../IncidentRecordCard.jsx", import.meta.url), "utf8");
const evidence = readFileSync(new URL("../EvidenceRecordCard.jsx", import.meta.url), "utf8");

test("the four initial modules remain on the shared card shell", () => {
  for (const source of [strategy, watch, documents, parties]) {
    assert.match(source, /import RecordCardShell/);
    assert.match(source, /<RecordCardShell/);
    assert.match(source, /RecordBadge/);
    assert.match(source, /RecordActions/);
    assert.match(source, /RecordMetadataRow/);
    assert.match(source, /RecordLinksRow/);
    assert.doesNotMatch(source, /<article[^>]+rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm/);
  }
});

test("Incident and Evidence use every shared card primitive", () => {
  for (const source of [incident, evidence]) {
    assert.match(source, /import RecordCardShell/);
    assert.match(source, /<RecordCardShell/);
    assert.match(source, /RecordBadge/);
    assert.match(source, /RecordActions/);
    assert.match(source, /RecordMetadataRow/);
    assert.match(source, /RecordLinksRow/);
  }
});

test("Strategy retains actions relationships attachment preview and details disclosure", () => {
  assert.match(strategy, /openEditRecordModal\("strategy", item\)/);
  assert.match(strategy, /onConvertRecord\?\.\("strategy", item\)/);
  assert.match(strategy, /deleteRecord\("strategy", item\.id\)/);
  assert.match(strategy, /<details/);
  assert.match(strategy, /AttachmentPreview/);
  assert.match(strategy, /expanded/);
});

test("Watch retains badges and actions while using the shell region order", () => {
  assert.match(watch, /title=\{item\.title \|\| "Untitled watch item"\}/);
  for (const handler of [/onEdit\(item\)/, /onConvert\(item, "incidents"\)/, /onConvert\(item, "strategy"\)/, /onDelete\(item\)/]) assert.match(watch, handler);
  assert.ok(watch.indexOf("<RecordMetadataRow") < watch.indexOf("<RecordLinksRow"));
  assert.ok(watch.indexOf("<RecordLinksRow") < watch.indexOf("What is being monitored"));
});

test("Documents retains four ordered actions metadata links and attachment preview", () => {
  const actionKeys = ['key: "open"', 'key: "edit"', 'key: "convert"', 'key: "delete"'];
  actionKeys.forEach((key, index) => { if (index) assert.ok(documents.indexOf(actionKeys[index - 1]) < documents.indexOf(key)); });
  assert.match(documents, /flex shrink-0 flex-wrap items-center gap-2 sm:flex-nowrap/);
  assert.match(documents, /onPreview=\{onPreviewFile\}/);
  assert.match(documents, /onClick: \(\) => onOpenLinkedRecord\(id\)/);
  assert.match(documents, /headingLevel=\{4\}/);
});

test("Parties retains confidentiality roles actions metadata and relationships", () => {
  assert.match(parties, /party\.confidentiality !== "normal"/);
  assert.match(parties, /party\.roles/);
  assert.match(parties, /openEditModal\(party\)/);
  assert.match(parties, /deleteParty\(party\)/);
  assert.match(parties, /subtitle=\{party\.legalName/);
  assert.match(parties, /relationship-to-case/);
});
