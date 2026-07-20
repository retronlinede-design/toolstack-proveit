import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./StrategyRecordCard.jsx", import.meta.url), "utf8");

test("strategy card exposes operational metadata and preserves record actions", () => {
  assert.match(source, /Objective/);
  assert.match(source, /Incidents/);
  assert.match(source, /Evidence/);
  assert.match(source, /Documents/);
  assert.match(source, /Ledger/);
  assert.match(source, /attachment/);
  assert.match(source, /Last updated/);
  assert.match(source, /openEditRecordModal\("strategy", item\)/);
  assert.match(source, /onConvertRecord\?\.\("strategy", item\)/);
  assert.match(source, /deleteRecord\("strategy", item\.id\)/);
});

test("strategy card omits optional sections when their fields are empty", () => {
  assert.match(source, /\{item\?\.description && \(/);
  assert.match(source, /\{item\?\.notes && \(/);
  assert.match(source, /\{linkedRecords\.length > 0 && \(/);
  assert.match(source, /\{attachmentCount > 0 && \(/);
  assert.match(source, /\{updatedAt && \(/);
});
