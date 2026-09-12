import { createRestoreSession } from "./restoreSession.js";

export async function buildFullBackupAttachment(att, { getImageById } = {}) {
  if (!att) return att;

  const cloned = { ...att };

  if (att.storage?.imageId) {
    const stored = await getImageById(att.storage.imageId);
    if (stored && stored.dataUrl) {
      cloned.backupDataUrl = stored.dataUrl;
    }
  }

  return cloned;
}

export async function buildFullBackupRecord(record, deps = {}) {
  if (!record) return record;

  const cloned = { ...record };

  cloned.attachments = await Promise.all(
    (record.attachments || []).map((att) => buildFullBackupAttachment(att, deps))
  );

  if (record.availability?.digital?.files) {
    cloned.availability = {
      ...record.availability,
      digital: {
        ...record.availability.digital,
        files: await Promise.all(
          (record.availability.digital.files || []).map((att) => buildFullBackupAttachment(att, deps))
        ),
      },
    };
  }

  return cloned;
}

export async function buildFullBackupCase(caseItem, deps = {}) {
  if (!caseItem) return caseItem;

  const cloned = { ...caseItem };

  cloned.evidence = await Promise.all(
    (caseItem.evidence || []).map((record) => buildFullBackupRecord(record, deps))
  );

  cloned.incidents = await Promise.all(
    (caseItem.incidents || []).map((record) => buildFullBackupRecord(record, deps))
  );

  cloned.tasks = await Promise.all(
    (caseItem.tasks || []).map((record) => buildFullBackupRecord(record, deps))
  );

  cloned.strategy = await Promise.all(
    (caseItem.strategy || []).map((record) => buildFullBackupRecord(record, deps))
  );

  cloned.watchItems = await Promise.all(
    (caseItem.watchItems || []).map((record) => buildFullBackupRecord(record, deps))
  );

  cloned.documents = await Promise.all(
    (caseItem.documents || []).map(async (doc) => ({
      ...doc,
      attachments: await Promise.all(
        (doc.attachments || []).map((att) => buildFullBackupAttachment(att, deps))
      ),
    }))
  );

  return cloned;
}

export async function buildFullBackupQuickCapture(capture, deps = {}) {
  if (!capture) return capture;

  const cloned = { ...capture };

  cloned.attachments = await Promise.all(
    (capture.attachments || []).map((att) => buildFullBackupAttachment(att, deps))
  );

  return cloned;
}

export async function restoreFullBackupAttachment(att, ownerId, deps = {}) {
  const { restoreStats } = deps;
  if (!att) return att;

  const cloned = { ...att };

  const session = deps.restoreSession || createRestoreSession(deps, [{ attachments: [att] }]);
  if (!session.hasPayload(att)) {
    return cloned;
  }

  try {
    const imageId = await session.restore(att, ownerId);

    cloned.storage = {
      ...(cloned.storage || {}),
      type: "indexeddb",
      imageId,
    };
    if (Object.hasOwn(cloned, "imageId")) cloned.imageId = imageId;
    // Remove backupDataUrl after restoring to keep the attachment clean
    delete cloned.backupDataUrl;
  } catch (err) {
    if (restoreStats && Array.isArray(restoreStats.failedAttachments)) {
      restoreStats.failedAttachments.push({
        ownerId: ownerId || "",
        attachmentId: att?.id || "",
        name: att?.name || "",
      });
    }
    console.error("Failed to restore attachment to IndexedDB", att?.id, err);
  }

  return cloned;
}

export async function restoreFullBackupRecord(record, deps = {}) {
  deps = { ...deps, restoreSession: deps.restoreSession || createRestoreSession(deps, [record]) };
  if (!record) return record;

  const cloned = { ...record };
  const ownerId = record.id || deps.generateId();

  if (Object.hasOwn(record, "attachments")) {
    cloned.attachments = await Promise.all(
      (record.attachments || []).map((att) => restoreFullBackupAttachment(att, ownerId, deps))
    );
  }

  if (record.availability?.digital?.files) {
    cloned.availability = {
      ...record.availability,
      digital: {
        ...record.availability.digital,
        files: await Promise.all(
          (record.availability.digital.files || []).map((att) =>
            restoreFullBackupAttachment(att, ownerId, deps)
          )
        ),
      },
    };
  }

  return cloned;
}

export async function restoreFullBackupDocument(doc, deps = {}) {
  deps = { ...deps, restoreSession: deps.restoreSession || createRestoreSession(deps, [doc]) };
  if (!doc) return doc;

  const cloned = { ...doc };
  const ownerId = doc.id || deps.generateId();

  if (Object.hasOwn(doc, "attachments")) {
    cloned.attachments = await Promise.all(
      (doc.attachments || []).map((att) => restoreFullBackupAttachment(att, ownerId, deps))
    );
  }

  return cloned;
}

export async function restoreFullBackupCase(caseItem, deps = {}) {
  deps = { ...deps, restoreSession: deps.restoreSession || createRestoreSession(deps, [caseItem]) };
  if (!caseItem) return caseItem;

  const cloned = { ...caseItem };
  const scopedDeps = deps;

  if (Object.hasOwn(caseItem, "evidence")) cloned.evidence = await Promise.all((caseItem.evidence || []).map((record) => restoreFullBackupRecord(record, scopedDeps)));
  if (Object.hasOwn(caseItem, "incidents")) cloned.incidents = await Promise.all((caseItem.incidents || []).map((record) => restoreFullBackupRecord(record, scopedDeps)));
  if (Object.hasOwn(caseItem, "tasks")) cloned.tasks = await Promise.all((caseItem.tasks || []).map((record) => restoreFullBackupRecord(record, scopedDeps)));
  if (Object.hasOwn(caseItem, "strategy")) cloned.strategy = await Promise.all((caseItem.strategy || []).map((record) => restoreFullBackupRecord(record, scopedDeps)));
  if (Object.hasOwn(caseItem, "watchItems")) cloned.watchItems = await Promise.all((caseItem.watchItems || []).map((record) => restoreFullBackupRecord(record, scopedDeps)));
  if (Object.hasOwn(caseItem, "documents")) cloned.documents = await Promise.all((caseItem.documents || []).map((doc) => restoreFullBackupDocument(doc, scopedDeps)));

  return cloned;
}

export async function restoreFullBackupQuickCapture(capture, deps = {}) {
  deps = { ...deps, restoreSession: deps.restoreSession || createRestoreSession(deps, [capture]) };
  if (!capture) return capture;

  const cloned = { ...capture };
  const ownerId = capture.id || deps.generateId();

  if (Object.hasOwn(capture, "attachments")) {
    cloned.attachments = await Promise.all(
      (capture.attachments || []).map((att) => restoreFullBackupAttachment(att, ownerId, deps))
    );
  }

  return cloned;
}

export async function buildFullBackupAllPayload({
  cases = [],
  quickCaptures = [],
  folders = [],
  sequenceGroupMeta = {},
  selectedCaseId = null,
  activeTab = "overview",
} = {}, deps = {}) {
  const backupFolders = Array.isArray(folders) ? folders : [];
  const backupCases = await Promise.all((cases || []).map((caseItem) => buildFullBackupCase(caseItem, deps)));
  const backupQuickCaptures = await Promise.all((quickCaptures || []).map((capture) => buildFullBackupQuickCapture(capture, deps)));

  return {
    app: "proveit",
    contractVersion: "2.0",
    exportType: "FULL_BACKUP_ALL",
    exportedAt: new Date().toISOString(),
    importable: true,
    includesBinaryData: true,
    metadata: {
      caseCount: backupCases.length,
      quickCaptureCount: backupQuickCaptures.length,
      folderCount: backupFolders.length,
    },
    appData: {
      folders: backupFolders,
      sequenceGroupMeta,
    },
    data: {
      cases: backupCases,
      quickCaptures: backupQuickCaptures,
      folders: backupFolders,
      selectedCaseId,
      activeTab,
    },
  };
}

export async function buildFullBackupCasePayload({
  caseItem,
  selectedCaseId = null,
  activeTab = "overview",
} = {}, deps = {}) {
  if (!caseItem) {
    throw new Error("caseItem is required for FULL_BACKUP_CASE");
  }

  return {
    app: "proveit",
    contractVersion: "2.0",
    exportType: "FULL_BACKUP_CASE",
    exportedAt: new Date().toISOString(),
    importable: true,
    includesBinaryData: true,
    data: {
      cases: [await buildFullBackupCase(caseItem, deps)],
      selectedCaseId: selectedCaseId ?? caseItem.id,
      activeTab,
    },
  };
}
