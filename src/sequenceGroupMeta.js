export const SEQUENCE_GROUP_META_STORAGE_KEY = "toolstack.proveit.v1.sequenceGroupMeta";

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function getStorage(storage) {
  if (storage) return storage;
  return typeof localStorage !== "undefined" ? localStorage : null;
}

function normalizeEntry(value) {
  const description = typeof value?.description === "string" ? value.description : "";
  const updatedAt = typeof value?.updatedAt === "string" ? value.updatedAt : "";
  if (!description && !updatedAt) return null;
  return { description, updatedAt };
}

export function normalizeSequenceGroupMetaStore(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  const store = {};
  Object.entries(value).forEach(([caseId, caseMeta]) => {
    const cleanCaseId = text(caseId);
    if (!cleanCaseId || !caseMeta || typeof caseMeta !== "object" || Array.isArray(caseMeta)) return;

    const normalizedCaseMeta = {};
    Object.entries(caseMeta).forEach(([groupName, entry]) => {
      const cleanGroupName = text(groupName);
      const normalizedEntry = normalizeEntry(entry);
      if (!cleanGroupName || !normalizedEntry) return;
      normalizedCaseMeta[cleanGroupName] = normalizedEntry;
    });

    if (Object.keys(normalizedCaseMeta).length > 0) {
      store[cleanCaseId] = normalizedCaseMeta;
    }
  });

  return store;
}

export function readSequenceGroupMetaStore(storage) {
  const targetStorage = getStorage(storage);
  if (!targetStorage) return {};

  try {
    return normalizeSequenceGroupMetaStore(JSON.parse(targetStorage.getItem(SEQUENCE_GROUP_META_STORAGE_KEY) || "{}"));
  } catch {
    return {};
  }
}

export function writeSequenceGroupMetaStore(store, storage) {
  const targetStorage = getStorage(storage);
  if (!targetStorage) return normalizeSequenceGroupMetaStore(store);

  const normalizedStore = normalizeSequenceGroupMetaStore(store);
  targetStorage.setItem(SEQUENCE_GROUP_META_STORAGE_KEY, JSON.stringify(normalizedStore));
  return normalizedStore;
}

export function getSequenceGroupMetaForCase(caseId, storeOrStorage) {
  const cleanCaseId = text(caseId);
  if (!cleanCaseId) return {};

  const store = storeOrStorage?.getItem
    ? readSequenceGroupMetaStore(storeOrStorage)
    : normalizeSequenceGroupMetaStore(storeOrStorage);
  return store[cleanCaseId] || {};
}

export function getSequenceGroupDescription(caseId, groupName, storeOrStorage) {
  const cleanGroupName = text(groupName);
  if (!cleanGroupName) return "";
  return getSequenceGroupMetaForCase(caseId, storeOrStorage)[cleanGroupName]?.description || "";
}

export function saveSequenceGroupDescription(caseId, groupName, description, storage) {
  const cleanCaseId = text(caseId);
  const cleanGroupName = text(groupName);
  if (!cleanCaseId || !cleanGroupName) return readSequenceGroupMetaStore(storage);

  const store = readSequenceGroupMetaStore(storage);
  const cleanDescription = typeof description === "string" ? description.trim() : "";
  if (!cleanDescription) return clearSequenceGroupDescription(caseId, groupName, storage);

  store[cleanCaseId] = {
    ...(store[cleanCaseId] || {}),
    [cleanGroupName]: {
      description: cleanDescription,
      updatedAt: new Date().toISOString(),
    },
  };

  return writeSequenceGroupMetaStore(store, storage);
}

export function clearSequenceGroupDescription(caseId, groupName, storage) {
  const cleanCaseId = text(caseId);
  const cleanGroupName = text(groupName);
  const store = readSequenceGroupMetaStore(storage);
  if (!cleanCaseId || !cleanGroupName || !store[cleanCaseId]?.[cleanGroupName]) return store;

  delete store[cleanCaseId][cleanGroupName];
  if (Object.keys(store[cleanCaseId]).length === 0) delete store[cleanCaseId];
  return writeSequenceGroupMetaStore(store, storage);
}

function mergeDescriptions(targetDescription, sourceDescription) {
  const target = text(targetDescription);
  const source = text(sourceDescription);
  if (!target) return source;
  if (!source || target === source || target.includes(source)) return target;
  return `${target}\n\n---\n\n${source}`;
}

export function renameSequenceGroupMeta(caseId, oldName, newName, storage) {
  const cleanCaseId = text(caseId);
  const cleanOldName = text(oldName);
  const cleanNewName = text(newName);
  const store = readSequenceGroupMetaStore(storage);
  const sourceEntry = store[cleanCaseId]?.[cleanOldName];
  if (!cleanCaseId || !cleanOldName || !cleanNewName || !sourceEntry) return store;

  const caseMeta = { ...(store[cleanCaseId] || {}) };
  const targetEntry = caseMeta[cleanNewName];
  caseMeta[cleanNewName] = {
    description: mergeDescriptions(targetEntry?.description, sourceEntry.description),
    updatedAt: new Date().toISOString(),
  };
  delete caseMeta[cleanOldName];
  store[cleanCaseId] = caseMeta;
  return writeSequenceGroupMetaStore(store, storage);
}

export function mergeSequenceGroupMeta(caseId, sourceName, targetName, storage) {
  const cleanCaseId = text(caseId);
  const cleanSourceName = text(sourceName);
  const cleanTargetName = text(targetName);
  const store = readSequenceGroupMetaStore(storage);
  const sourceEntry = store[cleanCaseId]?.[cleanSourceName];
  if (!cleanCaseId || !cleanSourceName || !cleanTargetName || !sourceEntry) return store;

  const caseMeta = { ...(store[cleanCaseId] || {}) };
  const targetEntry = caseMeta[cleanTargetName];
  caseMeta[cleanTargetName] = {
    description: mergeDescriptions(targetEntry?.description, sourceEntry.description),
    updatedAt: new Date().toISOString(),
  };
  delete caseMeta[cleanSourceName];
  store[cleanCaseId] = caseMeta;
  return writeSequenceGroupMetaStore(store, storage);
}

export function mergeSequenceGroupMetaStores(existingStore, incomingStore) {
  const merged = normalizeSequenceGroupMetaStore(existingStore);
  const incoming = normalizeSequenceGroupMetaStore(incomingStore);

  Object.entries(incoming).forEach(([caseId, caseMeta]) => {
    const currentCaseMeta = { ...(merged[caseId] || {}) };
    Object.entries(caseMeta).forEach(([groupName, entry]) => {
      const currentEntry = currentCaseMeta[groupName];
      currentCaseMeta[groupName] = {
        description: mergeDescriptions(currentEntry?.description, entry.description),
        updatedAt: currentEntry?.updatedAt && currentEntry.updatedAt > entry.updatedAt
          ? currentEntry.updatedAt
          : entry.updatedAt,
      };
    });
    merged[caseId] = currentCaseMeta;
  });

  return normalizeSequenceGroupMetaStore(merged);
}

export function mergeSequenceGroupMetaStoreToStorage(incomingStore, storage) {
  const current = readSequenceGroupMetaStore(storage);
  return writeSequenceGroupMetaStore(mergeSequenceGroupMetaStores(current, incomingStore), storage);
}
