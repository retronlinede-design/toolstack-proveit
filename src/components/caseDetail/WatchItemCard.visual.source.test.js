import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./WatchItemCard.jsx", import.meta.url), "utf8");

test("Watch uses the shared shell regions in the intended visual order", () => {
  assert.ok(source.indexOf("metadata={<RecordMetadataRow") < source.indexOf("links={<RecordLinksRow"));
  assert.ok(source.indexOf("links={<RecordLinksRow") < source.indexOf("What is being monitored"));
  assert.ok(source.indexOf("What is being monitored") < source.indexOf("Escalation triggers"));
  assert.ok(source.indexOf("Escalation triggers") < source.indexOf("Latest development"));
  assert.ok(source.indexOf("Latest development") < source.indexOf("Why it matters"));
});

test("Watch avoids duplicated shell spacing and nested card surfaces", () => {
  assert.doesNotMatch(source, /RecordMetadataRow className="mt-/);
  assert.doesNotMatch(source, /RecordLinksRow className="mt-/);
  assert.doesNotMatch(source, /rounded-lg border p-3/);
  assert.doesNotMatch(source, /expanded(?:=|\s)/);
  assert.equal((source.match(/border-t/g) || []).length, 1);
});

test("Watch keeps observation and escalation hierarchy restrained and dark compatible", () => {
  assert.match(source, /tone === "latest"/);
  assert.match(source, /text-base font-medium leading-6/);
  assert.match(source, /tone === "trigger"/);
  assert.match(source, /bg-amber-50\/60/);
  assert.match(source, /dark:bg-amber-950\/20/);
  assert.match(source, /dark:bg-sky-950\/20/);
  assert.match(source, /dark:border-neutral-800/);
});

test("Watch retains responsive wrapping without forcing a desktop three-column layout early", () => {
  assert.match(source, /flex flex-wrap gap-1\.5 sm:justify-end/);
  assert.match(source, /md:grid-cols-2 xl:grid-cols-3/);
  assert.match(source, /md:col-span-2 xl:col-span-1/);
  assert.match(source, /sm:grid-cols-2 lg:grid-cols-3/);
  assert.match(source, /\[overflow-wrap:anywhere\]/);
});

test("Watch preserves actions metadata relationships and monitoring content", () => {
  for (const action of ["Edit", "Escalate to Incident", "Convert to Strategy", "Delete"]) assert.match(source, new RegExp(`label: "${action}"`));
  for (const key of ["date-added", "review-date", "last-updated", "observations", "tags"]) assert.match(source, new RegExp(`key: "${key}"`));
  for (const key of ["sequence-group", "linked-records", "related-people", "attachments"]) assert.match(source, new RegExp(`key: "${key}"`));
  for (const field of ["watchFor", "triggerConditions", "latestObservation", "rationale", "nextCheck", "outcome"]) assert.match(source, new RegExp(`item\\.${field}`));
});
