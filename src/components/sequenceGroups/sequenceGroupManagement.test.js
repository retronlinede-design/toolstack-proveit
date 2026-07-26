import assert from "node:assert/strict";
import test from "node:test";

import { getCaseSequenceGroupDetails } from "../../domain/caseDomain.js";
import { getSequenceGroupDescription, getSequenceGroupMetaForCase } from "../../sequenceGroupMeta.js";
import {
  createManagedSequenceGroup,
  deleteManagedSequenceGroup,
  mergeManagedSequenceGroupDetails,
  updateManagedSequenceGroup,
  validateSequenceGroupInput,
} from "./sequenceGroupManagement.js";

function createStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => values.set(key, value),
  };
}

function buildCase() {
  return {
    id: "case-1",
    incidents: [{ id: "inc-1", title: "Incident", sequenceGroup: "Old Group" }],
    evidence: [{ id: "ev-1", title: "Evidence", sequenceGroup: "Old Group", linkedIncidentIds: ["inc-1"] }],
    documents: [{ id: "doc-1", title: "Document", sequenceGroup: "Old Group", linkedRecordIds: ["inc-1"] }],
    ledger: [{ id: "led-1", label: "Payment", sequenceGroup: "Old Group", linkedRecordIds: ["doc-1"] }],
    strategy: [{ id: "str-1", title: "Strategy", sequenceGroup: "Old Group", linkedRecordIds: ["inc-1"] }],
    watchItems: [{ id: "watch-1", title: "Watch", sequenceGroup: "Old Group", linkedRecordIds: ["inc-1"] }],
  };
}

test("sequence group input requires and trims a unique name", () => {
  assert.equal(validateSequenceGroupInput({ name: "   ", description: "x" }).error, "Name is required.");
  assert.equal(validateSequenceGroupInput({ name: " Existing " }, ["Existing"]).error, "A sequence group with this name already exists.");
  assert.deepEqual(validateSequenceGroupInput({ name: " New Group ", description: " Description " }).value, {
    name: "New Group",
    description: "Description",
  });
});

test("creating a group persists name and blank-compatible description without a record", () => {
  const storage = createStorage();
  const group = createManagedSequenceGroup("case-1", { name: " New Group ", description: "" }, storage);
  const metadata = getSequenceGroupMetaForCase("case-1", storage);
  const details = mergeManagedSequenceGroupDetails(getCaseSequenceGroupDetails(buildCase()), metadata);

  assert.deepEqual(group, { name: "New Group", description: "" });
  assert.equal(metadata["New Group"].description, "");
  assert.equal(details.groups.find((item) => item.name === "New Group").totalCount, 0);
});

test("editing a group name and description preserves every assigned record and link", () => {
  const storage = createStorage();
  createManagedSequenceGroup("case-1", { name: "Old Group", description: "Old description" }, storage);
  const original = buildCase();
  const result = updateManagedSequenceGroup(original, "Old Group", {
    name: " New Group ",
    description: " Updated description ",
  }, storage);

  for (const collection of ["incidents", "evidence", "documents", "strategy", "watchItems"]) {
    assert.equal(result.caseItem[collection][0].id, original[collection][0].id);
    assert.equal(result.caseItem[collection][0].sequenceGroup, "New Group");
  }
  assert.deepEqual(result.caseItem.evidence[0].linkedIncidentIds, ["inc-1"]);
  assert.equal(result.caseItem.ledger, original.ledger);
  assert.deepEqual(result.caseItem.ledger[0].linkedRecordIds, ["doc-1"]);
  assert.equal(getSequenceGroupDescription("case-1", "New Group", storage), "Updated description");
  assert.equal(getSequenceGroupDescription("case-1", "Old Group", storage), "");
});

test("editing only a description leaves the case and assignments untouched", () => {
  const storage = createStorage();
  const original = buildCase();
  const result = updateManagedSequenceGroup(original, "Old Group", {
    name: "Old Group",
    description: "Description only",
  }, storage);

  assert.equal(result.caseItem, original);
  assert.equal(getSequenceGroupDescription("case-1", "Old Group", storage), "Description only");
});

test("deleting a group clears references but retains records and removes metadata", () => {
  const storage = createStorage();
  createManagedSequenceGroup("case-1", { name: "Old Group", description: "Description" }, storage);
  const original = buildCase();
  const updated = deleteManagedSequenceGroup(original, "Old Group", storage);

  for (const collection of ["incidents", "evidence", "documents", "strategy", "watchItems"]) {
    assert.equal(updated[collection].length, 1);
    assert.equal(updated[collection][0].id, original[collection][0].id);
    assert.equal(updated[collection][0].sequenceGroup, "");
  }
  assert.deepEqual(updated.documents[0].linkedRecordIds, ["inc-1"]);
  assert.equal(updated.ledger, original.ledger);
  assert.equal(getSequenceGroupMetaForCase("case-1", storage)["Old Group"], undefined);
});
