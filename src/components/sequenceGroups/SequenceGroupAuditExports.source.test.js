import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../CaseDetail.jsx", import.meta.url), "utf8");

test("Sequence Group Audit exposes all three export scopes with accessible descriptions", () => {
  assert.match(source, /Export Selected Group/);
  assert.match(source, /Current group only\./);
  assert.match(source, /Export All Group Audits/);
  assert.match(source, /Consolidated overview of every sequence group\./);
  assert.match(source, /Export Full Case by Sequence Groups/);
  assert.match(source, /Complete case content arranged by group, including ungrouped records\./);
  assert.match(source, /aria-pressed=\{sequenceGroupAuditScope === value\}/);
});

test("each scope invokes its dedicated exporter and selected export keeps its original helpers", () => {
  for (const helper of [
    "buildAllSequenceGroupAuditsExport",
    "exportAllSequenceGroupAuditsMarkdown",
    "buildCaseBySequenceGroupsExport",
    "exportCaseBySequenceGroupsMarkdown",
    "exportSequenceGroupAuditJson",
    "exportSequenceGroupAuditMarkdown",
    "printSequenceGroupAuditPdf",
  ]) assert.match(source, new RegExp(`${helper}\\(`));

  assert.match(source, /sequenceGroupAuditScope === "selected" && !selectedSequenceGroupAuditGroup/);
  assert.match(source, /sequenceGroupAuditScope === "selected" && sequenceGroups\.length === 0/);
  assert.match(source, /URL\.revokeObjectURL\(url\)/);
});

test("consolidated downloads use safe scope filenames and existing MIME types", () => {
  assert.match(source, /all-sequence-group-audits/);
  assert.match(source, /full-case-by-sequence-groups/);
  assert.match(source, /"application\/json"/);
  assert.match(source, /"text\/markdown"/);
});
