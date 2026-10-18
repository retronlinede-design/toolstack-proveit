import assert from "node:assert/strict";
import test from "node:test";

import { getReportCentreIssueOptions, resolveReportCentreIssueSelection } from "./reportCentreIssueSelection.js";

function caseFixture() {
  return {
    issues: [
      { id: "issue-a", reference: "ISS-001", name: "Heating" },
      { id: "issue-b", reference: "ISS-002", name: "Heating" },
    ],
  };
}

test("Reports Centre selects an Issue by immutable canonical ID", () => {
  const options = getReportCentreIssueOptions(caseFixture());
  const selection = resolveReportCentreIssueSelection(options, "issue-b");
  assert.equal(selection.isValid, true);
  assert.equal(selection.selectedIssue.id, "issue-b");
  assert.equal(selection.sequenceGroupName, "Heating");
  assert.equal(selection.displayLabel, "ISS-002 — Heating");
});

test("renaming an Issue preserves its selected ID and refreshes only its display label", () => {
  const renamed = caseFixture();
  renamed.issues[0].name = "Heating repairs";
  const selection = resolveReportCentreIssueSelection(getReportCentreIssueOptions(renamed), "issue-a");
  assert.equal(selection.requestedIssueId, "issue-a");
  assert.equal(selection.sequenceGroupName, "Heating repairs");
  assert.equal(selection.displayLabel, "ISS-001 — Heating repairs");
});

test("duplicate Issue titles remain independently selectable by canonical ID", () => {
  const options = getReportCentreIssueOptions(caseFixture());
  assert.deepEqual(options.map((option) => option.id), ["issue-a", "issue-b"]);
  assert.deepEqual(options.map((option) => option.label), ["ISS-001 — Heating", "ISS-002 — Heating"]);
});

test("missing or deleted Issue IDs remain unresolved and never fall back to another Issue", () => {
  const selection = resolveReportCentreIssueSelection(getReportCentreIssueOptions(caseFixture()), "deleted-issue");
  assert.equal(selection.requestedIssueId, "deleted-issue");
  assert.equal(selection.isValid, false);
  assert.equal(selection.selectedIssue, null);
  assert.equal(selection.sequenceGroupName, "");
});

test("an empty Issue ID remains unselected for Issue-scoped reports", () => {
  const selection = resolveReportCentreIssueSelection(getReportCentreIssueOptions(caseFixture()), "");
  assert.equal(selection.isValid, false);
  assert.equal(selection.requestedIssueId, "");
});
