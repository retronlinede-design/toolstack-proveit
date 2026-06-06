import test from "node:test";
import assert from "node:assert/strict";

import {
  SEQUENCE_GROUP_META_STORAGE_KEY,
  clearSequenceGroupDescription,
  getSequenceGroupDescription,
  mergeSequenceGroupMeta,
  mergeSequenceGroupMetaStoreToStorage,
  readSequenceGroupMetaStore,
  renameSequenceGroupMeta,
  saveSequenceGroupDescription,
} from "./sequenceGroupMeta.js";

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

test("sequence group metadata rename carries description to new label", () => {
  const storage = createStorage();

  saveSequenceGroupDescription("case-1", "Old chain", "Original description", storage);
  renameSequenceGroupMeta("case-1", "Old chain", "New chain", storage);

  assert.equal(getSequenceGroupDescription("case-1", "Old chain", storage), "");
  assert.equal(getSequenceGroupDescription("case-1", "New chain", storage), "Original description");
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
