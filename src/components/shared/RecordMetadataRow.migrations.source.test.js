import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const strategy = readFileSync(new URL("../StrategyRecordCard.jsx", import.meta.url), "utf8");
const watch = readFileSync(new URL("../caseDetail/WatchItemCard.jsx", import.meta.url), "utf8");
const documents = readFileSync(new URL("../caseDetail/DocumentsTab.jsx", import.meta.url), "utf8");
const parties = readFileSync(new URL("../caseDetail/PartiesTab.jsx", import.meta.url), "utf8");

test("approved cards use RecordMetadataRow while retaining badges and actions", () => {
  for (const source of [strategy, watch, documents, parties]) {
    assert.match(source, /import RecordMetadataRow/);
    assert.match(source, /<RecordMetadataRow/);
    assert.match(source, /RecordBadge/);
    assert.match(source, /RecordActions/);
  }
});

test("Strategy preserves event owner review and update metadata order", () => {
  for (const key of ["event-date", "owner", "review-date", "last-updated"]) assert.match(strategy, new RegExp(`key: "${key}"`));
  assert.ok(strategy.indexOf('key: "owner"') < strategy.indexOf('key: "review-date"'));
  assert.match(strategy, /value: owner\?\.name/);
  assert.match(strategy, /value: reviewDate/);
});

test("Watch preserves all existing metadata values in order", () => {
  const keys = ["date-added", "review-date", "sequence-group", "last-updated", "observations", "linked-records", "related-people", "tags", "attachments"];
  keys.forEach((key, index) => {
    assert.match(watch, new RegExp(`key: "${key}"`));
    if (index) assert.ok(watch.indexOf(`key: "${keys[index - 1]}"`) < watch.indexOf(`key: "${key}"`));
  });
  assert.match(watch, /item\.linkedRecordIds\.length - links\.length/);
});

test("Documents preserves date category source and count metadata", () => {
  assert.ok(documents.indexOf('key: "document-date"') < documents.indexOf('key: "document-type"'));
  assert.ok(documents.indexOf('key: "document-type"') < documents.indexOf('key: "source"'));
  assert.match(documents, /doc\.documentDate \|\| "No date"/);
  assert.match(documents, /attachmentCount/);
  assert.match(documents, /linkedCount/);
});

test("Parties preserves organisation and contact field ordering without pipe markup", () => {
  for (const keys of [["job-title", "department", "organisation"], ["email", "phone", "website"]]) {
    keys.forEach((key, index) => { if (index) assert.ok(parties.indexOf(`key: "${keys[index - 1]}"`) < parties.indexOf(`key: "${key}"`)); });
  }
  assert.doesNotMatch(parties, /join\(" \| "\)/);
  assert.match(parties, /party\.relationshipToCase/);
});
