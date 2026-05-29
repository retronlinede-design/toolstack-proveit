import test from "node:test";
import assert from "node:assert/strict";

import {
  RESCUE_SNAPSHOT_STORAGE_KEY,
  buildRescueSnapshot,
  readRescueSnapshot,
  stripBinaryPayloads,
  writeRescueSnapshot,
} from "./rescueSnapshot.js";

function withFakeLocalStorage(callback) {
  const originalLocalStorage = globalThis.localStorage;
  const values = new Map();
  globalThis.localStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
  };

  try {
    return callback(values);
  } finally {
    globalThis.localStorage = originalLocalStorage;
  }
}

test("stripBinaryPayloads removes attachment binary fields recursively", () => {
  const stripped = stripBinaryPayloads({
    id: "case-1",
    evidence: [{
      id: "ev-1",
      attachments: [{
        id: "att-1",
        name: "photo.png",
        dataUrl: "data:image/png;base64,abc",
        backupDataUrl: "data:image/png;base64,backup",
        storage: { imageId: "img-1" },
      }],
    }],
  });

  assert.deepEqual(stripped, {
    id: "case-1",
    evidence: [{
      id: "ev-1",
      attachments: [{
        id: "att-1",
        name: "photo.png",
        storage: { imageId: "img-1" },
      }],
    }],
  });
});

test("buildRescueSnapshot stores case structure, folders, and image count without binaries", () => {
  const snapshot = buildRescueSnapshot({
    cases: [{ id: "case-1", attachments: [{ backupDataUrl: "data:big", name: "file.pdf" }] }],
    folders: [{ id: "folder-1", name: "Finance" }],
    quickCaptures: [{ id: "capture-1", dataUrl: "data:big" }],
    imageCount: 48,
  });

  assert.equal(snapshot.caseCount, 1);
  assert.equal(snapshot.folderCount, 1);
  assert.equal(snapshot.imageCount, 48);
  assert.equal(snapshot.quickCaptureCount, 1);
  assert.equal(snapshot.data.cases[0].attachments[0].backupDataUrl, undefined);
  assert.equal(snapshot.data.quickCaptures[0].dataUrl, undefined);
});

test("writeRescueSnapshot refuses to overwrite with zero cases", () => {
  withFakeLocalStorage((values) => {
    const existing = writeRescueSnapshot({ cases: [{ id: "case-1" }] });
    const result = writeRescueSnapshot({ cases: [] });

    assert.equal(result, null);
    assert.deepEqual(JSON.parse(values.get(RESCUE_SNAPSHOT_STORAGE_KEY)), existing);
  });
});

test("readRescueSnapshot reports a valid stored rescue snapshot", () => {
  withFakeLocalStorage(() => {
    writeRescueSnapshot({
      cases: [{ id: "case-1" }],
      folders: [{ id: "folder-1", name: "Finance" }],
      imageCount: 3,
    });

    const rescue = readRescueSnapshot();
    assert.equal(rescue.available, true);
    assert.equal(rescue.caseCount, 1);
    assert.equal(rescue.folderCount, 1);
    assert.equal(rescue.imageCount, 3);
  });
});
