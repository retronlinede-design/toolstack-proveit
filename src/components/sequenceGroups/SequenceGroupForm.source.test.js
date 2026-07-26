import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./SequenceGroupForm.jsx", import.meta.url), "utf8");
const managerSource = readFileSync(new URL("./SequenceGroupManager.jsx", import.meta.url), "utf8");
const caseDetailSource = readFileSync(new URL("../CaseDetail.jsx", import.meta.url), "utf8");

test("SequenceGroupForm shares create and edit fields and validates before saving", () => {
  assert.match(source, /mode === "edit" \? "Edit Sequence Group" : "New Sequence Group"/);
  assert.match(source, />Name</);
  assert.match(source, />Description</);
  assert.match(source, /validateSequenceGroupInput\(form, existingNames/);
  assert.match(source, /onSave\(result\.value\)/);
});

test("create and management cancellation close their modal without saving", () => {
  assert.match(source, /key: "cancel", label: "Cancel", onClick: onCancel/);
  assert.match(managerSource, /onCancel=\{\(\) => setGroupForm\(null\)\}/);
  assert.match(managerSource, /setGroupForm\(\{ mode: "create", initialValue: null \}\)/);
  assert.match(managerSource, /mode: "manage"/);
  assert.match(managerSource, /<SequenceGroupManagementModal/);
});

test("manager callbacks select created and edited groups and confirm destructive deletion", () => {
  assert.match(caseDetailSource, /setSelectedSequenceGroupName\(group\.name\)/);
  assert.match(caseDetailSource, /setSelectedSequenceGroupName\(result\.group\.name\)/);
  assert.match(caseDetailSource, /window\.confirm/);
  assert.match(caseDetailSource, /records were kept and are now ungrouped/);
});
