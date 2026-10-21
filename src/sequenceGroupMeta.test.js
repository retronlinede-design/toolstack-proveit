import test from "node:test";
import assert from "node:assert/strict";
import { normalizeCaseIssues, updateCaseIssue } from "./domain/issueDomain.js";

import {
  SEQUENCE_GROUP_META_STORAGE_KEY,
  clearSequenceGroupDescription,
  deleteSequenceGroupMeta,
  getSequenceGroupDescription,
  mergeSequenceGroupMeta,
  mergeSequenceGroupMetaStoreToStorage,
  readSequenceGroupMetaStore,
  renameSequenceGroupMeta,
  renameSequenceGroupMetaInStore,
  resolveSequenceGroupMergeDescription,
  saveSequenceGroupMeta,
  saveSequenceGroupDescription,
} from "./sequenceGroupMeta.js";

test("merge description modes are explicit and avoid duplicate appends", () => {
  assert.equal(resolveSequenceGroupMergeDescription("Destination", "Source", "keep"), "Destination");
  assert.equal(resolveSequenceGroupMergeDescription("Destination", "Source", "replace"), "Source");
  assert.equal(resolveSequenceGroupMergeDescription("Destination", "Source", "append"), "Destination\n\n---\n\nSource");
  assert.equal(resolveSequenceGroupMergeDescription("Same", "Same", "append"), "Same");
  assert.equal(resolveSequenceGroupMergeDescription("Destination", "Source", "edit", " Combined "), "Combined");
});

function createStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}

test("sequence group metadata saves, loads, and clears descriptions", () => {
  const storage = createStorage();

  saveSequenceGroupDescription("case-1", "Notice chain", "Notice and repair timeline", storage);
  assert.equal(getSequenceGroupDescription("case-1", "Notice chain", storage), "Notice and repair timeline");

  clearSequenceGroupDescription("case-1", "Notice chain", storage);
  assert.equal(getSequenceGroupDescription("case-1", "Notice chain", storage), "");
});

test("sequence group metadata preserves an explicitly created group with a blank description", () => {
  const storage = createStorage();
  saveSequenceGroupMeta("case-1", "Empty group", { description: "" }, storage);
  assert.equal(readSequenceGroupMetaStore(storage)["case-1"]["Empty group"].description, "");

  deleteSequenceGroupMeta("case-1", "Empty group", storage);
  assert.equal(readSequenceGroupMetaStore(storage)["case-1"], undefined);
});

test("sequence group metadata rename carries description to new label", () => {
  const storage = createStorage();

  saveSequenceGroupDescription("case-1", "Old chain", "Original description", storage);
  renameSequenceGroupMeta("case-1", "Old chain", "New chain", storage);

  assert.equal(getSequenceGroupDescription("case-1", "Old chain", storage), "");
  assert.equal(getSequenceGroupDescription("case-1", "New chain", storage), "Original description");
});

test("staged metadata rename is immutable until a caller explicitly persists it", () => {
  const original = {
    "case-1": {
      "Old chain": { description: "Original description", updatedAt: "2026-01-01T00:00:00.000Z" },
    },
    "case-2": {
      "Unrelated chain": { description: "Unrelated", updatedAt: "2026-01-02T00:00:00.000Z" },
    },
  };
  const before = structuredClone(original);

  const staged = renameSequenceGroupMetaInStore(original, "case-1", "Old chain", "New chain", "2026-02-01T00:00:00.000Z");

  assert.deepEqual(original, before);
  assert.equal(staged["case-1"]["Old chain"], undefined);
  assert.deepEqual(staged["case-1"]["New chain"], {
    description: "Original description",
    updatedAt: "2026-02-01T00:00:00.000Z",
  });
  assert.deepEqual(staged["case-2"], original["case-2"]);
});

test("a staged rename prevents a phantom legacy Issue while a failed save retains the original metadata", () => {
  const caseData = {
    id: "case-1",
    issues: [{ id: "issue-1", reference: "ISS-001", name: "Old chain", description: "", status: "open", priority: "normal" }],
    incidents: [{ id: "incident-1", sequenceGroupId: "issue-1", sequenceGroup: "Old chain" }],
  };
  const originalStore = { "case-1": { "Old chain": { description: "Legacy", updatedAt: "2026-01-01T00:00:00.000Z" } } };
  const renamed = updateCaseIssue(caseData, "issue-1", { name: "New chain" });
  const stagedStore = renameSequenceGroupMetaInStore(originalStore, "case-1", "Old chain", "New chain", "2026-02-01T00:00:00.000Z");

  assert.equal(renamed.success, true);
  assert.equal(normalizeCaseIssues(renamed.caseData, { sequenceGroupMeta: stagedStore["case-1"] }).caseData.issues.length, 1);
  assert.equal(normalizeCaseIssues(caseData, { sequenceGroupMeta: originalStore["case-1"] }).caseData.issues.length, 1);
  assert.deepEqual(originalStore, { "case-1": { "Old chain": { description: "Legacy", updatedAt: "2026-01-01T00:00:00.000Z" } } });
});

test("sequence group metadata merge appends both descriptions when target already has one", () => {
  const storage = createStorage();

  saveSequenceGroupDescription("case-1", "Source chain", "Source description", storage);
  saveSequenceGroupDescription("case-1", "Target chain", "Target description", storage);
  mergeSequenceGroupMeta("case-1", "Source chain", "Target chain", storage);

  assert.equal(
    getSequenceGroupDescription("case-1", "Target chain", storage),
    "Target description\n\n---\n\nSource description"
  );
  assert.equal(getSequenceGroupDescription("case-1", "Source chain", storage), "");
});

test("sequence group metadata import merges safely into localStorage", () => {
  const storage = createStorage({
    [SEQUENCE_GROUP_META_STORAGE_KEY]: JSON.stringify({
      "case-1": {
        "Target chain": {
          description: "Local description",
          updatedAt: "2024-01-01T00:00:00.000Z",
        },
      },
    }),
  });

  mergeSequenceGroupMetaStoreToStorage({
    "case-1": {
      "Target chain": {
        description: "Imported description",
        updatedAt: "2024-02-01T00:00:00.000Z",
      },
    },
  }, storage);

  const store = readSequenceGroupMetaStore(storage);
  assert.equal(store["case-1"]["Target chain"].description, "Local description\n\n---\n\nImported description");
  assert.equal(store["case-1"]["Target chain"].updatedAt, "2024-02-01T00:00:00.000Z");
});
