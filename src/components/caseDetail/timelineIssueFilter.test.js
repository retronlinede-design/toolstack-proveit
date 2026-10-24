import assert from "node:assert/strict";
import test from "node:test";

import {
  isTimelineIssueFilterValid,
  isTimelineItemInIssueFilter,
  TIMELINE_ALL_ISSUES_FILTER,
  TIMELINE_UNASSIGNED_ISSUES_FILTER,
} from "./timelineIssueFilter.js";

const caseData = {
  issues: [
    { id: "issue-1", reference: "ISS-001", name: "Repairs" },
    { id: "issue-2", reference: "ISS-002", name: "Payments" },
  ],
};

test("Timeline filters canonical Issue records by stable ID and retain the selection through a rename", () => {
  const item = { source: { sequenceGroupId: "issue-1", sequenceGroup: "Repairs" } };

  assert.equal(isTimelineItemInIssueFilter(caseData, item, "issue-1"), true);
  assert.equal(isTimelineItemInIssueFilter(caseData, item, "issue-2"), false);

  const renamed = {
    ...caseData,
    issues: [{ ...caseData.issues[0], name: "Urgent repairs" }, caseData.issues[1]],
  };
  assert.equal(isTimelineIssueFilterValid(renamed, "issue-1"), true);
  assert.equal(isTimelineItemInIssueFilter(renamed, { source: { sequenceGroupId: "issue-1", sequenceGroup: "Urgent repairs" } }, "issue-1"), true);
});

test("Timeline filters invalidate deleted or merged-away Issue IDs instead of selecting another Issue", () => {
  const withoutSelectedIssue = { issues: [caseData.issues[1]] };

  assert.equal(isTimelineIssueFilterValid(withoutSelectedIssue, "issue-1"), false);
  assert.equal(isTimelineItemInIssueFilter(withoutSelectedIssue, { source: { sequenceGroupId: "issue-2" } }, "issue-1"), false);
});

test("Timeline filters preserve all and unassigned record behaviour", () => {
  const unassigned = { source: {} };
  const legacyNamed = { source: { sequenceGroup: "Repairs" } };
  const canonical = { source: { sequenceGroupId: "issue-1", sequenceGroup: "Repairs" } };

  assert.equal(isTimelineItemInIssueFilter(caseData, unassigned, TIMELINE_UNASSIGNED_ISSUES_FILTER), true);
  assert.equal(isTimelineItemInIssueFilter(caseData, legacyNamed, TIMELINE_UNASSIGNED_ISSUES_FILTER), false);
  assert.equal(isTimelineItemInIssueFilter(caseData, canonical, TIMELINE_UNASSIGNED_ISSUES_FILTER), false);
  assert.equal(isTimelineItemInIssueFilter(caseData, canonical, TIMELINE_ALL_ISSUES_FILTER), true);
});

test("Timeline filters allow legacy name-only records only through an unambiguous canonical name", () => {
  assert.equal(isTimelineItemInIssueFilter(caseData, { source: { sequenceGroup: "Repairs" } }, "issue-1"), true);

  const duplicateNames = {
    issues: [
      { id: "issue-1", reference: "ISS-001", name: "Repairs" },
      { id: "issue-3", reference: "ISS-003", name: "Repairs" },
    ],
  };
  assert.equal(isTimelineItemInIssueFilter(duplicateNames, { source: { sequenceGroup: "Repairs" } }, "issue-1"), false);
  assert.equal(isTimelineItemInIssueFilter(duplicateNames, { source: { sequenceGroupId: "issue-1", sequenceGroup: "Repairs" } }, "issue-1"), true);
});

test("Timeline Issue filtering does not mutate mixed canonical or legacy source records", () => {
  const items = [
    { source: { sequenceGroupId: "issue-1", sequenceGroup: "Repairs" } },
    { source: { sequenceGroup: "Payments" } },
    { source: {} },
  ];
  const before = structuredClone(items);

  assert.deepEqual(items.filter((item) => isTimelineItemInIssueFilter(caseData, item, "issue-1")), [items[0]]);
  assert.deepEqual(items, before);
});
