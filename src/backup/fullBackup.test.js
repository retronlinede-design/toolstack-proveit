import test from "node:test";
import assert from "node:assert/strict";

import {
  buildFullBackupAllPayload,
  buildFullBackupAttachment,
  buildFullBackupCase,
  buildFullBackupCasePayload,
  buildFullBackupQuickCapture,
  buildFullBackupRecord,
  restoreFullBackupAttachment,
  restoreFullBackupCase,
  restoreFullBackupQuickCapture,
  restoreFullBackupRecord,
} from "./fullBackup.js";

test("buildFullBackupAttachment preserves metadata and includes binary payload when available", async () => {
  const calls = [];
  const attachment = {
    id: "att-1",
    name: "photo.png",
    createdAt: "2024-01-01T09:00:00.000Z",
    storage: { type: "indexeddb", imageId: "img-1" },
  };

  const result = await buildFullBackupAttachment(attachment, {
    getImageById: async (id) => {
      calls.push(id);
      return { id, dataUrl: "data:image/png;base64,abc" };
    },
  });

  assert.deepEqual(calls, ["img-1"]);
  assert.deepEqual(result, {
    ...attachment,
    backupDataUrl: "data:image/png;base64,abc",
  });
  assert.notEqual(result, attachment);
});

test("buildFullBackupRecord case and quick capture preserve current structure", async () => {
  const deps = {
    getImageById: async (id) => ({ id, dataUrl: `data:${id}` }),
  };
  const record = {
    id: "ev-1",
    title: "Evidence",
    attachments: [{ id: "att-1", storage: { imageId: "img-1" } }],
    availability: {
      physical: { hasOriginal: true },
      digital: {
        hasDigital: true,
        files: [{ id: "att-2", storage: { imageId: "img-2" } }],
      },
    },
  };
  const caseItem = {
    id: "case-1",
    evidence: [record],
    incidents: [],
    tasks: [],
    strategy: [],
    documents: [{ id: "doc-1", attachments: [{ id: "doc-att", storage: { imageId: "img-doc" } }] }],
  };
  const capture = {
    id: "cap-1",
    attachments: [{ id: "cap-att", storage: { imageId: "img-cap" } }],
  };

  const backedRecord = await buildFullBackupRecord(record, deps);
  const backedCase = await buildFullBackupCase(caseItem, deps);
  const backedCapture = await buildFullBackupQuickCapture(capture, deps);

  assert.equal(backedRecord.attachments[0].backupDataUrl, "data:img-1");
  assert.equal(backedRecord.availability.digital.files[0].backupDataUrl, "data:img-2");
  assert.equal(backedCase.evidence[0].attachments[0].backupDataUrl, "data:img-1");
  assert.equal(backedCase.documents[0].attachments[0].backupDataUrl, "data:img-doc");
  assert.equal(backedCapture.attachments[0].backupDataUrl, "data:img-cap");
  assert.deepEqual(backedCase.incidents, []);
  assert.deepEqual(backedCase.tasks, []);
  assert.deepEqual(backedCase.strategy, []);
});

test("restore helpers recreate attachment metadata with current stored id selection behavior", async () => {
  const saved = [];
  const deps = {
    generateId: () => "generated-id",
    saveImage: async (image) => {
      saved.push(image);
    },
  };

  const restored = await restoreFullBackupAttachment({
    id: "att-1",
    name: "photo.png",
    createdAt: "2024-01-01T09:00:00.000Z",
    backupDataUrl: "data:image/png;base64,abc",
  }, "owner-1", deps);

  assert.deepEqual(saved, [{
    id: "att-1",
    evidenceId: "owner-1",
    dataUrl: "data:image/png;base64,abc",
    createdAt: "2024-01-01T09:00:00.000Z",
  }]);
  assert.deepEqual(restored, {
    id: "att-1",
    name: "photo.png",
    createdAt: "2024-01-01T09:00:00.000Z",
    storage: {
      type: "indexeddb",
      imageId: "att-1",
    },
  });
});

test("restore helpers preserve log-and-continue behavior on attachment restore failures", async () => {
  const originalError = console.error;
  const errors = [];
  console.error = (...args) => {
    errors.push(args);
  };

  try {
    const restored = await restoreFullBackupAttachment({
      id: "att-fail",
      backupDataUrl: "data:image/png;base64,bad",
    }, "owner-1", {
      generateId: () => "generated-id",
      saveImage: async () => {
        throw new Error("write failed");
      },
    });

    assert.equal(restored.id, "att-fail");
    assert.equal(restored.backupDataUrl, "data:image/png;base64,bad");
    assert.equal(restored.storage, undefined);
    assert.equal(errors.length, 1);
    assert.equal(errors[0][0], "Failed to restore attachment to IndexedDB");
    assert.equal(errors[0][1], "att-fail");
  } finally {
    console.error = originalError;
  }
});

test("restoreFullBackupRecord case and quick capture preserve current structure", async () => {
  const saved = [];
  const deps = {
    generateId: () => "generated-owner",
    saveImage: async (image) => {
      saved.push(image);
    },
  };
  const record = {
    id: "ev-1",
    attachments: [{ id: "att-1", backupDataUrl: "data:att-1" }],
    availability: {
      digital: {
        files: [{ id: "att-2", backupDataUrl: "data:att-2" }],
      },
    },
  };
  const caseItem = {
    id: "case-1",
    evidence: [record],
    incidents: [],
    tasks: [],
    strategy: [],
    documents: [{ id: "doc-1", attachments: [{ id: "doc-att", backupDataUrl: "data:doc" }] }],
  };
  const capture = {
    id: "cap-1",
    attachments: [{ id: "cap-att", backupDataUrl: "data:cap" }],
  };

  const restoredRecord = await restoreFullBackupRecord(record, deps);
  const restoredCase = await restoreFullBackupCase(caseItem, deps);
  const restoredCapture = await restoreFullBackupQuickCapture(capture, deps);

  assert.equal(restoredRecord.attachments[0].storage.imageId, "att-1");
  assert.equal(restoredRecord.availability.digital.files[0].storage.imageId, "att-2");
  assert.equal(restoredCase.evidence[0].attachments[0].storage.imageId, "att-1");
  assert.equal(restoredCase.documents[0].attachments[0].storage.imageId, "doc-att");
  assert.equal(restoredCapture.attachments[0].storage.imageId, "cap-att");
  assert.ok(saved.some((item) => item.evidenceId === "ev-1" && item.id === "att-1"));
  assert.ok(saved.some((item) => item.evidenceId === "doc-1" && item.id === "doc-att"));
  assert.ok(saved.some((item) => item.evidenceId === "cap-1" && item.id === "cap-att"));
});

test("full backup payload builders return the current top-level shape", async () => {
  const deps = {
    getImageById: async (id) => ({ id, dataUrl: `data:${id}` }),
  };
  const caseItem = {
    id: "case-1",
    evidence: [{ id: "ev-1", attachments: [{ id: "att-1", storage: { imageId: "img-1" } }] }],
    incidents: [],
    tasks: [],
    strategy: [],
    documents: [],
  };
  const capture = {
    id: "cap-1",
    attachments: [{ id: "cap-att", storage: { imageId: "img-cap" } }],
  };

  const allPayload = await buildFullBackupAllPayload({
    cases: [caseItem],
    quickCaptures: [capture],
    selectedCaseId: "case-1",
    activeTab: "evidence",
  }, deps);
  const casePayload = await buildFullBackupCasePayload({
    caseItem,
    selectedCaseId: null,
    activeTab: "overview",
  }, deps);

  assert.equal(allPayload.app, "proveit");
  assert.equal(allPayload.contractVersion, "2.0");
  assert.equal(allPayload.exportType, "FULL_BACKUP_ALL");
  assert.equal(allPayload.importable, true);
  assert.equal(allPayload.includesBinaryData, true);
  assert.match(allPayload.exportedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(allPayload.data.selectedCaseId, "case-1");
  assert.equal(allPayload.data.activeTab, "evidence");
  assert.equal(allPayload.data.cases[0].evidence[0].attachments[0].backupDataUrl, "data:img-1");
  assert.equal(allPayload.data.quickCaptures[0].attachments[0].backupDataUrl, "data:img-cap");

  assert.equal(casePayload.exportType, "FULL_BACKUP_CASE");
  assert.deepEqual(casePayload.data.quickCaptures, undefined);
  assert.equal(casePayload.data.selectedCaseId, "case-1");
  assert.equal(casePayload.data.activeTab, "overview");
  assert.equal(casePayload.data.cases[0].id, "case-1");
});
