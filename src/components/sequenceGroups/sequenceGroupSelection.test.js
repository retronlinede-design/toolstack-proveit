import assert from "node:assert/strict";
import test from "node:test";
import { didSequenceGroupSelectionChange, resolveSequenceGroupReturnTarget, resolveSequenceGroupSelection } from "./sequenceGroupSelection.js";

const caseData = {
  issues: [
    { id: "issue-a", reference: "ISS-001", name: "First Issue" },
    { id: "issue-b", reference: "ISS-002", name: "Renamed Issue" },
  ],
};

const groups = [
  { name: "First Issue", issue: caseData.issues[0] },
  { name: "Renamed Issue", issue: caseData.issues[1] },
  { name: "Legacy only", issue: null },
];

test("canonical manager selection survives a rename through its stable ID", () => {
  const result = resolveSequenceGroupSelection(caseData, groups, { issueId: "issue-b", groupName: "Old Issue Name" });
  assert.equal(result.group.name, "Renamed Issue");
  assert.equal(result.issue.id, "issue-b");
  assert.equal(result.invalidCanonicalSelection, false);
});

test("an invalid canonical manager selection never falls back to the first group", () => {
  const result = resolveSequenceGroupSelection(caseData, groups, { issueId: "deleted-issue", groupName: "First Issue" });
  assert.equal(result.group, null);
  assert.equal(result.issue, null);
  assert.equal(result.invalidCanonicalSelection, true);
});

test("legacy-only group navigation remains name-based when no canonical ID exists", () => {
  const result = resolveSequenceGroupSelection(caseData, groups, { groupName: "Legacy only" });
  assert.equal(result.group.name, "Legacy only");
  assert.equal(result.issue, null);
  assert.equal(result.invalidCanonicalSelection, false);
});

test("editor return targets the saved record destination by canonical ID", () => {
  const result = resolveSequenceGroupReturnTarget(caseData, { issueId: "issue-b", groupName: "First Issue" });
  assert.equal(result.issue.id, "issue-b");
  assert.equal(result.groupName, "Renamed Issue");
});

test("a stale editor return ID does not fall back to a same-named or unrelated Issue", () => {
  const result = resolveSequenceGroupReturnTarget(caseData, { issueId: "deleted-issue", groupName: "First Issue" });
  assert.equal(result.issue, null);
  assert.equal(result.groupName, "");
  assert.equal(result.invalidCanonicalSelection, true);
});

test("record return treats a rename of the same canonical Issue as staying in place", () => {
  assert.equal(didSequenceGroupSelectionChange(
    { issue: { id: "issue-b" }, groupName: "Old name" },
    { issue: { id: "issue-b" }, groupName: "Renamed Issue" },
  ), false);
  assert.equal(didSequenceGroupSelectionChange(
    { issue: { id: "issue-a" }, groupName: "First Issue" },
    { issue: { id: "issue-b" }, groupName: "Renamed Issue" },
  ), true);
});
