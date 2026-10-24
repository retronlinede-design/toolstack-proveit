import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const directory = path.dirname(fileURLToPath(import.meta.url));
const manager = fs.readFileSync(path.join(directory, "SequenceGroupManager.jsx"), "utf8");
const caseDetail = fs.readFileSync(path.join(directory, "../CaseDetail.jsx"), "utf8");
const app = fs.readFileSync(path.join(directory, "../../App.jsx"), "utf8");

test("Issue Manager resolves an explicit canonical selection before the legacy display name", () => {
  assert.match(manager, /resolveSequenceGroupSelection\(selectedCase, managedSequenceGroupDetails\.groups/);
  assert.match(manager, /issueId: selectedIssueId/);
  assert.doesNotMatch(manager, /groups\.find\(\(group\) => group\.name === selectedGroupName\) \|\| managedSequenceGroupDetails\.groups\[0\]/);
  assert.match(manager, /Selected Issue is no longer available/);
});

test("record-editor return context carries canonical source and destination Issue IDs", () => {
  assert.match(caseDetail, /selectedIssueId: originatingSelection\.issue\?\.id \|\| selectedSequenceGroupId/);
  assert.match(caseDetail, /activeGroupId: managerContext\.selectedIssueId/);
  assert.match(caseDetail, /issueId: nextSequenceGroupId/);
  assert.match(caseDetail, /selectedIssueId=\{selectedSequenceGroupId\}/);
  assert.match(app, /previousSequenceGroupId: sequenceManagerContext\.activeGroupId \|\| ""/);
  assert.match(app, /nextSequenceGroupId: savedRecord\?\.sequenceGroupId \|\| ""/);
  assert.match(app, /nextSequenceGroupId: savedDocument\?\.sequenceGroupId \|\| ""/);
});
