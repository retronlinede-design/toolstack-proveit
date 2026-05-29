export const RESCUE_SNAPSHOT_STORAGE_KEY = "toolstack.proveit.v1.rescueSnapshot";
export const RESCUE_SNAPSHOT_TYPE = "PROVEIT_RESCUE_SNAPSHOT";
export const QUICK_CAPTURE_RESCUE_MAX_CHARS = 100000;

const BINARY_FIELD_NAMES = new Set([
  "arrayBuffer",
  "backupDataUrl",
  "base64",
  "binary",
  "blob",
  "bytes",
  "dataUrl",
  "file",
  "thumbnailDataUrl",
]);

export function stripBinaryPayloads(value) {
  if (Array.isArray(value)) {
    return value.map(stripBinaryPayloads);
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  const stripped = {};
  for (const [key, childValue] of Object.entries(value)) {
    if (BINARY_FIELD_NAMES.has(key)) continue;
    stripped[key] = stripBinaryPayloads(childValue);
  }
  return stripped;
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function maybeIncludeQuickCaptures(quickCaptures) {
  const stripped = stripBinaryPayloads(safeArray(quickCaptures));
  return JSON.stringify(stripped).length <= QUICK_CAPTURE_RESCUE_MAX_CHARS ? stripped : [];
}

export function buildRescueSnapshot({
  cases = [],
  folders = [],
  quickCaptures = [],
  imageCount = 0,
} = {}) {
  const strippedCases = stripBinaryPayloads(safeArray(cases));
  const strippedFolders = stripBinaryPayloads(safeArray(folders));
  const strippedQuickCaptures = maybeIncludeQuickCaptures(quickCaptures);

  return {
    type: RESCUE_SNAPSHOT_TYPE,
    timestamp: new Date().toISOString(),
    caseCount: strippedCases.length,
    folderCount: strippedFolders.length,
    imageCount: Number.isFinite(imageCount) ? imageCount : 0,
    quickCaptureCount: strippedQuickCaptures.length,
    quickCapturesIncluded: strippedQuickCaptures.length === safeArray(quickCaptures).length,
    data: {
      cases: strippedCases,
      folders: strippedFolders,
      quickCaptures: strippedQuickCaptures,
    },
  };
}

export function writeRescueSnapshot(input) {
  const snapshot = buildRescueSnapshot(input);
  if (snapshot.caseCount === 0) return null;
  try {
    localStorage.setItem(RESCUE_SNAPSHOT_STORAGE_KEY, JSON.stringify(snapshot));
  } catch (error) {
    console.warn("Could not write Rescue Snapshot", error);
    return null;
  }
  return snapshot;
}

export function readRescueSnapshot() {
  try {
    const saved = localStorage.getItem(RESCUE_SNAPSHOT_STORAGE_KEY);
    if (!saved) return { available: false, corrupt: false };

    const parsed = JSON.parse(saved);
    if (
      !parsed ||
      typeof parsed !== "object" ||
      parsed.type !== RESCUE_SNAPSHOT_TYPE ||
      !parsed.data ||
      !Array.isArray(parsed.data.cases)
    ) {
      return { available: false, corrupt: true };
    }

    return {
      available: parsed.caseCount > 0,
      corrupt: false,
      snapshot: parsed,
      timestamp: typeof parsed.timestamp === "string" ? parsed.timestamp : "",
      caseCount: Number.isFinite(parsed.caseCount) ? parsed.caseCount : parsed.data.cases.length,
      folderCount: Number.isFinite(parsed.folderCount) ? parsed.folderCount : safeArray(parsed.data.folders).length,
      imageCount: Number.isFinite(parsed.imageCount) ? parsed.imageCount : 0,
    };
  } catch {
    return { available: false, corrupt: true };
  }
}

export function readRescueSnapshotSummary() {
  const rescue = readRescueSnapshot();
  return {
    exists: rescue.available && !rescue.corrupt,
    timestamp: rescue.timestamp || "",
    caseCount: rescue.caseCount || 0,
    folderCount: rescue.folderCount || 0,
    imageCount: rescue.imageCount || 0,
    corrupt: Boolean(rescue.corrupt),
  };
}
