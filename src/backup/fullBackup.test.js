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

test("AUDIT-006: full backup payload reports complete binary accounting when every referenced binary is available", async () => {
  const payload = await buildFullBackupAllPayload({
    cases: [{
      id: "case-available",
      evidence: [{ id: "evidence-available", attachments: [{ id: "att-available", storage: { imageId: "img-available" } }] }],
    }],
  }, {
    getImageById: async () => ({ dataUrl: "data:image/png;base64,available" }),
  });

  assert.equal(payload.includesBinaryData, true);
  assert.deepEqual(payload.binaryData, {
    expected: 1,
    included: 1,
    missing: 0,
    failed: 0,
    complete: true,
    missingReferences: [],
  });
  assert.equal(payload.data.cases[0].evidence[0].attachments[0].backupDataUrl, "data:image/png;base64,available");
});

test("AUDIT-006: full backup payload is explicitly partial when one or more referenced binaries are absent", async () => {
  const payload = await buildFullBackupAllPayload({
    cases: [{
      id: "case-missing",
      evidence: [{ id: "evidence-missing", attachments: [
        { id: "att-present", storage: { imageId: "img-present" } },
        { id: "att-missing-one", name: "one.pdf", storage: { imageId: "img-missing-one" } },
        { id: "att-missing-two", name: "two.pdf", storage: { imageId: "img-missing-two" } },
      ] }],
    }],
  }, {
    getImageById: async (id) => id === "img-present" ? { dataUrl: "data:present" } : undefined,
  });

  assert.equal(payload.includesBinaryData, false);
  assert.deepEqual(payload.binaryData, {
    expected: 3,
    included: 1,
    missing: 2,
    failed: 0,
    complete: false,
    missingReferences: [
      { attachmentId: "att-missing-one", name: "one.pdf", imageId: "img-missing-one", reason: "missing" },
      { attachmentId: "att-missing-two", name: "two.pdf", imageId: "img-missing-two", reason: "missing" },
    ],
  });
  assert.equal(payload.data.cases[0].evidence[0].attachments[0].backupDataUrl, "data:present");
  assert.equal(payload.data.cases[0].evidence[0].attachments[1].backupDataUrl, undefined);
});

test("AUDIT-006: full backup preserves available data and records retrieval failures as partial", async () => {
  const payload = await buildFullBackupAllPayload({
    cases: [{
      id: "case-failure",
      evidence: [{ id: "evidence-failure", attachments: [
        { id: "att-available", storage: { imageId: "img-available" } },
        { id: "att-failed", name: "unreadable.png", storage: { imageId: "img-failed" } },
      ] }],
    }],
  }, {
    getImageById: async (id) => {
      if (id === "img-failed") throw new Error("IndexedDB read failed");
      return { dataUrl: "data:available" };
    },
  });

  assert.deepEqual(payload.binaryData, {
    expected: 2,
    included: 1,
    missing: 1,
    failed: 1,
    complete: false,
    missingReferences: [{ attachmentId: "att-failed", name: "unreadable.png", imageId: "img-failed", reason: "failed" }],
  });
  assert.equal(payload.data.cases[0].evidence[0].attachments[0].backupDataUrl, "data:available");
});

test("AUDIT-006: cases without attachments and mixed case/capture data receive truthful aggregate binary accounting", async () => {
  const noAttachmentPayload = await buildFullBackupCasePayload({ caseItem: { id: "case-empty", evidence: [] } }, {
    getImageById: async () => { throw new Error("should not read"); },
  });
  assert.deepEqual(noAttachmentPayload.binaryData, {
    expected: 0,
    included: 0,
    missing: 0,
    failed: 0,
    complete: true,
    missingReferences: [],
  });

  const mixedPayload = await buildFullBackupAllPayload({
    cases: [
      { id: "case-one", evidence: [{ id: "evidence-one", attachments: [{ id: "att-one", storage: { imageId: "img-one" } }] }] },
      { id: "case-two", documents: [{ id: "document-two", attachments: [{ id: "att-two", storage: { imageId: "img-two" } }] }] },
    ],
    quickCaptures: [{ id: "capture-three", attachments: [{ id: "att-three", storage: { imageId: "img-three" } }] }],
  }, {
    getImageById: async (id) => id === "img-one" ? { dataUrl: "data:one" } : undefined,
  });
  assert.deepEqual(mixedPayload.binaryData, {
    expected: 3,
    included: 1,
    missing: 2,
    failed: 0,
    complete: false,
    missingReferences: [
      { attachmentId: "att-two", name: "", imageId: "img-two", reason: "missing" },
      { attachmentId: "att-three", name: "", imageId: "img-three", reason: "missing" },
    ],
  });
});

test("restore helpers preserve attachment identity while assigning fresh storage IDs", async () => {
  const saved = [];
  const deps = {
    generateId: () => "generated-id",
    addImage: async (image) => {
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
    id: "generated-id",
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
      imageId: "generated-id",
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
      addImage: async () => {
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
    generateId: (() => { let next = 0; return () => `fresh-${++next}`; })(),
    addImage: async (image) => {
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

  assert.equal(restoredRecord.attachments[0].storage.imageId, "fresh-1");
  assert.equal(restoredRecord.availability.digital.files[0].storage.imageId, "fresh-2");
  assert.equal(restoredCase.evidence[0].attachments[0].storage.imageId, "fresh-3");
  assert.equal(restoredCase.documents[0].attachments[0].storage.imageId, "fresh-5");
  assert.equal(restoredCapture.attachments[0].storage.imageId, "fresh-6");
  assert.ok(saved.some((item) => item.evidenceId === "ev-1" && item.id === "fresh-1"));
  assert.ok(saved.some((item) => item.evidenceId === "doc-1" && item.id === "fresh-5"));
  assert.ok(saved.some((item) => item.evidenceId === "cap-1" && item.id === "fresh-6"));
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
    folders: [{ id: "folder-1", name: "Finance" }],
    sequenceGroupMeta: {
      "case-1": {
        "Notice chain": {
          description: "Notice and repair timeline",
          updatedAt: "2024-01-01T00:00:00.000Z",
        },
      },
    },
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
  assert.deepEqual(allPayload.metadata, {
    caseCount: 1,
    quickCaptureCount: 1,
    folderCount: 1,
  });
  assert.deepEqual(allPayload.appData.folders, [{ id: "folder-1", name: "Finance" }]);
  assert.deepEqual(allPayload.appData.sequenceGroupMeta, {
    "case-1": {
      "Notice chain": {
        description: "Notice and repair timeline",
        updatedAt: "2024-01-01T00:00:00.000Z",
      },
    },
  });
  assert.equal(allPayload.data.selectedCaseId, "case-1");
  assert.equal(allPayload.data.activeTab, "evidence");
  assert.equal(allPayload.data.cases[0].evidence[0].attachments[0].backupDataUrl, "data:img-1");
  assert.equal(allPayload.data.quickCaptures[0].attachments[0].backupDataUrl, "data:img-cap");
  assert.deepEqual(allPayload.data.folders, [{ id: "folder-1", name: "Finance" }]);

  assert.equal(casePayload.exportType, "FULL_BACKUP_CASE");
  assert.deepEqual(casePayload.data.quickCaptures, undefined);
  assert.equal(casePayload.data.selectedCaseId, "case-1");
  assert.equal(casePayload.data.activeTab, "overview");
  assert.equal(casePayload.data.cases[0].id, "case-1");
});
