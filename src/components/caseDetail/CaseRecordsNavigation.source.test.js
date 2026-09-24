import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../CaseDetail.jsx", import.meta.url), "utf8");

test("Case Records groups the legacy Records and Ledger tab identifiers without changing their routing", () => {
  assert.match(source, /activeTab === "records" \|\| activeTab === "ledger"/);
  assert.match(source, /activeTab === "ledger" \? "ledger" : "records"/);
  assert.match(source, /\{ id: "records", label: "Case Records" \}/);
  assert.match(source, /tab\.id === "ledger" \? \[\] : \[tab\]/);
  assert.match(source, /setActiveTab\(view\.id\)/);
  assert.match(source, /\{activeTab === "ledger" && \(/);
  assert.match(source, /\{activeTab === "records" && \(/);
});

test("Case Records navigation keeps the legacy Ledger route visibly active", () => {
  assert.match(source, /tab\.id === "records" \? isCaseRecordsWorkspace : activeTab === tab\.id/);
  assert.match(source, /value=\{isCaseRecordsWorkspace \? "records" : activeTab\}/);
});
