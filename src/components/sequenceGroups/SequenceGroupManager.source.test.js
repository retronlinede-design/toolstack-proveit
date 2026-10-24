import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./SequenceGroupManager.jsx", import.meta.url), "utf8");

test("SequenceGroupManager keeps grouped sections and required actions available", () => {
  for (const label of [
    "Overview",
    "Records",
    "Diagnostics",
    "AI Tools",
    "Exports",
    "Edit",
    "Open",
    "More",
    "Copy Full Chain Markdown",
    "Copy Chain Completion Markdown",
    "Open Chain Audit",
    "Copy Full Chain JSON",
    "Copy Chain Completion JSON",
    "Download Group Index JSON",
    "Download Group Index Markdown",
    "Rename",
    "Merge",
    "Clear group label",
    "New Issue",
    "Create Issue",
    "Manage Group",
    "Delete Group",
    "No dated records",
  ]) {
    assert.equal(source.includes(label), true, `${label} should remain visible in the manager UI`);
  }
});

test("SequenceGroupManager uses the shared group form and management callbacks", () => {
  assert.match(source, /<DialogShell/);
  assert.match(source, /layer="manager"/);
  assert.match(source, /suspendFocusManagement=\{Boolean\(groupForm\)\}/);
  assert.match(source, /<SequenceGroupForm/);
  assert.match(source, /<SequenceGroupManagementModal/);
  assert.match(source, /mode=\{groupForm\.mode\}/);
  assert.match(source, /onCreateGroup/);
  assert.match(source, /onUpdateGroup/);
  assert.match(source, /onDeleteGroup/);
  assert.match(source, /mergeManagedSequenceGroupDetails/);
  assert.match(source, /SequenceGroupDescription/);
  assert.match(source, /RecordActions/);
  assert.match(source, /RecordBadge/);
});

test("SequenceGroupManager protects the local description draft during navigation", () => {
  assert.match(source, /baseline: savedSequenceDescription/);
  assert.match(source, /const descriptionDraftDirty = sequenceDescriptionDraft !== activeDescriptionDraft\.baseline/);
  assert.match(source, /Discard unsaved Issue description changes\?/);
  assert.match(source, /Keep editing/);
  assert.match(source, /requestSelectedGroup\(group\.name\)/);
  assert.match(source, /requestSection\(section\)/);
  assert.match(source, /const savedStore = saveSequenceGroupDescription/);
  assert.match(source, /setSequenceDescriptionDraftState\(\{ key: sequenceDescriptionDraftKey, value: savedDescription, baseline: savedDescription \}\)/);
});

test("SequenceGroupManager saves canonical Issue descriptions through the revision-safe update callback", () => {
  assert.match(source, /getManagedSequenceGroupDescription\(selectedGroup\?\.issue, legacySequenceDescription\)/);
  assert.match(source, /await onUpdateGroup\?\.\(activeGroupName, \{ description: sequenceDescriptionDraft \}\)/);
  assert.match(source, /await onUpdateGroup\?\.\(activeGroupName, \{ description: "" \}\)/);
  assert.match(source, /if \(!saved\) return;/);
  assert.match(source, /if \(selectedGroup\?\.issue\)/);
  assert.doesNotMatch(source, /Saved canonical description/);
  assert.doesNotMatch(source, /Cleared canonical description/);
});

test("SequenceGroupManager forwards canonical Issue export scope to AI handoff actions", () => {
  assert.match(source, /function getIssueExportScope\(group\)/);
  assert.match(source, /issueId: group\?\.issue\?\.id \|\| ""/);
  assert.match(source, /onCopyFullChainGptPackJson\?\.\(getIssueExportScope\(group\)\)/);
  assert.match(source, /onCopyChainCompletionPackMarkdown\?\.\(getIssueExportScope\(selectedGroup\)\)/);
});
