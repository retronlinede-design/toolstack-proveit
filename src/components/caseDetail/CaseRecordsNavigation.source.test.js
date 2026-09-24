import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../CaseDetail.jsx", import.meta.url), "utf8");

test("Case Records is the sole normal destination while legacy Records and Ledger identifiers remain routable", () => {
  assert.match(source, /activeTab === "records" \|\| activeTab === "ledger"/);
  assert.match(source, /\{ id: "records", label: "Case Records" \}/);
  assert.match(source, /tab\.id === "ledger" \? \[\] : \[tab\]/);
  assert.match(source, /\{activeTab === "ledger" && \(/);
  assert.match(source, /\{activeTab === "records" && \(/);
  assert.match(source, /Back to Case Records/);
  assert.match(source, /setActiveTab\("records"\)/);
});

test("Case Records navigation keeps a legacy Ledger route visibly active without offering it normally", () => {
  assert.match(source, /tab\.id === "records" \? isCaseRecordsWorkspace : activeTab === tab\.id/);
  assert.match(source, /value=\{isCaseRecordsWorkspace \? "records" : activeTab\}/);
  assert.doesNotMatch(source, /aria-label="Case Records view"/);
  assert.doesNotMatch(source, /\{ label: "Ledger", tabId: "ledger"/);
});
