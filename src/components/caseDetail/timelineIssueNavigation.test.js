import assert from "node:assert/strict";
import test from "node:test";

import { resolveTimelineIssueNavigationTarget } from "./timelineIssueNavigation.js";

const caseData = {
  issues: [
    { id: "issue-1", reference: "ISS-001", name: "Repairs" },
    { id: "issue-2", reference: "ISS-002", name: "Payments" },
  ],
};

test("Timeline Issue navigation resolves a canonical source ID before its display name", () => {
  const target = resolveTimelineIssueNavigationTarget(caseData, {
    sequenceGroupId: "issue-1",
    sequenceGroup: "Stale display label",
  });

  assert.equal(target?.id, "issue-1");
});

test("Timeline Issue navigation supports legacy name-only records only when unambiguous", () => {
  assert.equal(resolveTimelineIssueNavigationTarget(caseData, { sequenceGroup: "Payments" })?.id, "issue-2");
  assert.equal(resolveTimelineIssueNavigationTarget(caseData, { sequenceGroup: "Unknown" }), null);

  const duplicateNames = {
    issues: [
      { id: "issue-1", reference: "ISS-001", name: "Repairs" },
      { id: "issue-3", reference: "ISS-003", name: "Repairs" },
    ],
  };
  assert.equal(resolveTimelineIssueNavigationTarget(duplicateNames, { sequenceGroup: "Repairs" }), null);
});

test("Timeline Issue navigation does not fall back from an unresolved canonical ID to a display name", () => {
  assert.equal(resolveTimelineIssueNavigationTarget(caseData, {
    sequenceGroupId: "deleted-issue",
    sequenceGroup: "Repairs",
  }), null);
});
