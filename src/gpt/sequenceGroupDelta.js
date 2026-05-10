import {
  clearRecordSequenceGroup,
  getCaseSequenceGroupDetails,
  getCaseSequenceGroups,
  mergeCaseSequenceGroups,
  moveRecordToSequenceGroup,
  renameCaseSequenceGroup,
} from "../domain/caseDomain.js";

export const SEQUENCE_GROUP_DELTA_CONTRACT_VERSION = "sequence-group-delta-1.0";
export const SEQUENCE_GROUP_REVIEW_EXPORT_TYPE = "SEQUENCE_GROUP_REVIEW_PACKAGE";

const SUPPORTED_RECORD_TYPES = ["incidents", "evidence", "documents", "strategy"];
const SUPPORTED_OPERATION_KEYS = ["moveRecords", "renameGroups", "mergeGroups", "clearRecords"];

function safeText(value) {
  return typeof value === "string" ? value : "";
}

function trimText(value) {
  return safeText(value).trim();
}

function compactText(value, limit = 240) {
  const text = trimText(value).replace(/\s+/g, " ");
  if (text.length <= limit) return text;
  return `${text.slice(0, limit - 1).trim()}...`;
}

function list(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string" && item.trim()).map((item) => item.trim()) : [];
}

function getRecordTitle(record, recordType) {
  if (recordType === "ledger") return trimText(record?.label) || "Untitled ledger entry";
  return trimText(record?.title) || trimText(record?.name) || "Untitled record";
}

function getRecordDate(record) {
  return trimText(record?.eventDate)
    || trimText(record?.date)
    || trimText(record?.documentDate)
    || trimText(record?.capturedAt)
    || trimText(record?.createdAt)
    || "";
}

function getRecordSummary(record) {
  return compactText(
    record?.summary
    || record?.description
    || record?.functionSummary
    || record?.notes
    || "",
  );
}

function getLinkedIncidentIds(record) {
  const explicitIds = list(record?.linkedIncidentIds);
  const refIds = Array.isArray(record?.linkedIncidentRefs)
    ? record.linkedIncidentRefs.map((ref) => trimText(ref?.incidentId)).filter(Boolean)
    : [];
  return [...new Set([...explicitIds, ...refIds])];
}

function getLinkedEvidenceIds(record, recordType) {
  const explicitIds = list(record?.linkedEvidenceIds);
  const basedOnEvidenceIds = recordType === "documents" ? list(record?.basedOnEvidenceIds) : [];
  return [...new Set([...explicitIds, ...basedOnEvidenceIds])];
}

function buildReviewRecord(record, recordType) {
  return {
    recordType,
    id: trimText(record?.id),
    title: getRecordTitle(record, recordType),
    date: getRecordDate(record),
    status: trimText(record?.status),
    summary: getRecordSummary(record),
    linkedRecordIds: list(record?.linkedRecordIds),
    linkedIncidentIds: getLinkedIncidentIds(record),
    linkedEvidenceIds: getLinkedEvidenceIds(record, recordType),
  };
}

function getGroupWarnings(group) {
  const warnings = [];
  if (group?.warnings?.noIncidents) warnings.push("Group has no incidents.");
  if (group?.warnings?.incidentsWithoutEvidence) warnings.push("Group has incidents but no evidence.");
  return warnings;
}

function buildReviewRecordsByGroup(caseItem) {
  const groups = new Map();
  const ungroupedRecords = [];

  SUPPORTED_RECORD_TYPES.forEach((recordType) => {
    const records = Array.isArray(caseItem?.[recordType]) ? caseItem[recordType] : [];
    records.forEach((record) => {
      if (!record?.id) return;
      const reviewRecord = buildReviewRecord(record, recordType);
      const groupName = trimText(record.sequenceGroup);
      if (!groupName) {
        ungroupedRecords.push(reviewRecord);
        return;
      }
      if (!groups.has(groupName)) groups.set(groupName, []);
      groups.get(groupName).push(reviewRecord);
    });
  });

  return { groups, ungroupedRecords };
}

export function buildSequenceGroupReviewPackage(caseItem, options = {}) {
  const details = getCaseSequenceGroupDetails(caseItem);
  const reviewRecords = buildReviewRecordsByGroup(caseItem);
  const caseId = trimText(caseItem?.id);
  const caseName = trimText(caseItem?.name) || "Untitled case";
  const diagnostics = {
    totalGroups: details.groups.length,
    totalUngroupedRecords: Object.values(details.ungroupedRecords).reduce((sum, records) => sum + records.length, 0),
    groupsWithoutIncidents: details.groups.filter((group) => group.warnings.noIncidents).map((group) => group.name),
    groupsWithIncidentsButNoEvidence: details.groups.filter((group) => group.warnings.incidentsWithoutEvidence).map((group) => group.name),
  };

  return {
    app: "proveit",
    exportType: SEQUENCE_GROUP_REVIEW_EXPORT_TYPE,
    contractVersion: "1.0",
    caseId,
    caseName,
    exportedAt: options.exportedAt || new Date().toISOString(),
    groups: details.groups.map((group) => ({
      name: group.name,
      counts: { ...group.counts },
      warnings: getGroupWarnings(group),
      records: reviewRecords.groups.get(group.name) || [],
    })),
    ungroupedRecords: reviewRecords.ungroupedRecords,
    diagnostics,
    instructions: "Analyze the sequence groups. Suggest only grouping cleanup changes. Do not edit record content. When asked for JSON, return only sequence-group-delta-1.0.",
  };
}

function hasOnlyKeys(value, allowedKeys, path, errors) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    errors.push(`${path} must be an object.`);
    return false;
  }

  Object.keys(value).forEach((key) => {
    if (!allowedKeys.includes(key)) {
      errors.push(`Unsupported field at ${path}.${key}.`);
    }
  });
  return true;
}

function findRecord(caseItem, recordType, recordId) {
  const records = Array.isArray(caseItem?.[recordType]) ? caseItem[recordType] : [];
  return records.find((record) => trimText(record?.id) === recordId) || null;
}

function getExistingGroupSet(caseItem) {
  return new Set(getCaseSequenceGroups(caseItem).map((group) => group.name));
}

function getRecordCurrentGroup(record) {
  return trimText(record?.sequenceGroup);
}

function countGroupRecords(caseItem, groupName) {
  return SUPPORTED_RECORD_TYPES.reduce((sum, recordType) => {
    const records = Array.isArray(caseItem?.[recordType]) ? caseItem[recordType] : [];
    return sum + records.filter((record) => getRecordCurrentGroup(record) === groupName).length;
  }, 0);
}

function createEmptyPreview() {
  return {
    moveRecords: [],
    renameGroups: [],
    mergeGroups: [],
    clearRecords: [],
  };
}

function parseDelta(deltaInput, errors) {
  if (typeof deltaInput !== "string") return deltaInput;
  try {
    return JSON.parse(deltaInput);
  } catch (error) {
    errors.push(`Invalid JSON: ${error.message}`);
    return null;
  }
}

function validateMoveRecords(moveRecords, caseItem, errors, warnings, preview, recordTargets) {
  if (moveRecords == null) return;
  if (!Array.isArray(moveRecords)) {
    errors.push("operations.moveRecords must be an array.");
    return;
  }

  moveRecords.forEach((operation, index) => {
    const path = `operations.moveRecords[${index}]`;
    hasOnlyKeys(operation, ["recordType", "recordId", "targetGroup"], path, errors);
    const recordType = trimText(operation?.recordType);
    const recordId = trimText(operation?.recordId);
    const targetGroup = trimText(operation?.targetGroup);
    const key = `${recordType}:${recordId}`;

    if (!SUPPORTED_RECORD_TYPES.includes(recordType)) errors.push(`${path}.recordType must be one of incidents, evidence, documents, strategy.`);
    if (!recordId) errors.push(`${path}.recordId is required.`);
    if (!targetGroup) errors.push(`${path}.targetGroup must be a non-empty string.`);

    const record = SUPPORTED_RECORD_TYPES.includes(recordType) && recordId ? findRecord(caseItem, recordType, recordId) : null;
    if (recordType && recordId && !record) errors.push(`${path} references unknown ${recordType} record "${recordId}".`);

    if (recordTargets.has(key)) {
      const existingTarget = recordTargets.get(key);
      if (existingTarget !== targetGroup) {
        errors.push(`${path} conflicts with another operation for ${key}.`);
      } else {
        warnings.push(`${path} duplicates an identical move for ${key}.`);
      }
    }
    recordTargets.set(key, targetGroup);

    if (record && targetGroup) {
      preview.moveRecords.push({
        recordType,
        recordId,
        title: getRecordTitle(record, recordType),
        fromGroup: getRecordCurrentGroup(record),
        targetGroup,
      });
    }
  });
}

function validateRenameGroups(renameGroups, caseItem, errors, warnings, preview, groupSources) {
  if (renameGroups == null) return;
  if (!Array.isArray(renameGroups)) {
    errors.push("operations.renameGroups must be an array.");
    return;
  }

  const existingGroups = getExistingGroupSet(caseItem);
  renameGroups.forEach((operation, index) => {
    const path = `operations.renameGroups[${index}]`;
    hasOnlyKeys(operation, ["fromGroup", "toGroup"], path, errors);
    const fromGroup = trimText(operation?.fromGroup);
    const toGroup = trimText(operation?.toGroup);

    if (!fromGroup) errors.push(`${path}.fromGroup is required.`);
    if (!toGroup) errors.push(`${path}.toGroup must be a non-empty string.`);
    if (fromGroup && !existingGroups.has(fromGroup)) errors.push(`${path}.fromGroup "${fromGroup}" does not exist.`);
    if (fromGroup && toGroup && fromGroup === toGroup) errors.push(`${path}.toGroup must be different from fromGroup.`);

    if (groupSources.has(fromGroup)) {
      const existing = groupSources.get(fromGroup);
      if (existing.operationType !== "renameGroups" || existing.toGroup !== toGroup) {
        errors.push(`${path} conflicts with another group operation for "${fromGroup}".`);
      } else {
        warnings.push(`${path} duplicates an identical rename for "${fromGroup}".`);
      }
    }
    if (fromGroup) groupSources.set(fromGroup, { operationType: "renameGroups", toGroup });

    if (fromGroup && toGroup && existingGroups.has(fromGroup)) {
      preview.renameGroups.push({
        fromGroup,
        toGroup,
        affectedCount: countGroupRecords(caseItem, fromGroup),
      });
    }
  });
}

function validateMergeGroups(mergeGroups, caseItem, errors, warnings, preview, groupSources) {
  if (mergeGroups == null) return;
  if (!Array.isArray(mergeGroups)) {
    errors.push("operations.mergeGroups must be an array.");
    return;
  }

  const existingGroups = getExistingGroupSet(caseItem);
  mergeGroups.forEach((operation, index) => {
    const path = `operations.mergeGroups[${index}]`;
    hasOnlyKeys(operation, ["fromGroup", "toGroup"], path, errors);
    const fromGroup = trimText(operation?.fromGroup);
    const toGroup = trimText(operation?.toGroup);

    if (!fromGroup) errors.push(`${path}.fromGroup is required.`);
    if (!toGroup) errors.push(`${path}.toGroup must be a non-empty string.`);
    if (fromGroup && !existingGroups.has(fromGroup)) errors.push(`${path}.fromGroup "${fromGroup}" does not exist.`);
    if (toGroup && !existingGroups.has(toGroup)) errors.push(`${path}.toGroup "${toGroup}" does not exist.`);
    if (fromGroup && toGroup && fromGroup === toGroup) errors.push(`${path}.toGroup must be different from fromGroup.`);

    if (groupSources.has(fromGroup)) {
      const existing = groupSources.get(fromGroup);
      if (existing.operationType !== "mergeGroups" || existing.toGroup !== toGroup) {
        errors.push(`${path} conflicts with another group operation for "${fromGroup}".`);
      } else {
        warnings.push(`${path} duplicates an identical merge for "${fromGroup}".`);
      }
    }
    if (fromGroup) groupSources.set(fromGroup, { operationType: "mergeGroups", toGroup });

    if (fromGroup && toGroup && existingGroups.has(fromGroup) && existingGroups.has(toGroup)) {
      preview.mergeGroups.push({
        fromGroup,
        toGroup,
        affectedCount: countGroupRecords(caseItem, fromGroup),
      });
    }
  });
}

function validateClearRecords(clearRecords, caseItem, errors, warnings, preview, recordTargets) {
  if (clearRecords == null) return;
  if (!Array.isArray(clearRecords)) {
    errors.push("operations.clearRecords must be an array.");
    return;
  }

  clearRecords.forEach((operation, index) => {
    const path = `operations.clearRecords[${index}]`;
    hasOnlyKeys(operation, ["recordType", "recordId"], path, errors);
    const recordType = trimText(operation?.recordType);
    const recordId = trimText(operation?.recordId);
    const key = `${recordType}:${recordId}`;

    if (!SUPPORTED_RECORD_TYPES.includes(recordType)) errors.push(`${path}.recordType must be one of incidents, evidence, documents, strategy.`);
    if (!recordId) errors.push(`${path}.recordId is required.`);

    const record = SUPPORTED_RECORD_TYPES.includes(recordType) && recordId ? findRecord(caseItem, recordType, recordId) : null;
    if (recordType && recordId && !record) errors.push(`${path} references unknown ${recordType} record "${recordId}".`);

    if (recordTargets.has(key)) {
      errors.push(`${path} conflicts with a move operation for ${key}.`);
    }
    recordTargets.set(key, "");

    if (record) {
      preview.clearRecords.push({
        recordType,
        recordId,
        title: getRecordTitle(record, recordType),
        fromGroup: getRecordCurrentGroup(record),
      });
    }
  });
}

export function validateSequenceGroupDelta(deltaInput, caseItem) {
  const errors = [];
  const warnings = [];
  const preview = createEmptyPreview();
  const delta = parseDelta(deltaInput, errors);

  if (!delta) {
    return { ok: false, errors, warnings, preview, delta: null };
  }

  hasOnlyKeys(delta, ["app", "contractVersion", "target", "operations"], "delta", errors);

  if (delta.app !== "proveit") errors.push('delta.app must be "proveit".');
  if (delta.contractVersion !== SEQUENCE_GROUP_DELTA_CONTRACT_VERSION) {
    errors.push(`delta.contractVersion must be "${SEQUENCE_GROUP_DELTA_CONTRACT_VERSION}".`);
  }

  hasOnlyKeys(delta.target, ["caseId"], "delta.target", errors);
  const targetCaseId = trimText(delta.target?.caseId);
  const selectedCaseId = trimText(caseItem?.id);
  if (!targetCaseId) {
    errors.push("delta.target.caseId is required.");
  } else if (targetCaseId !== "AUTO" && targetCaseId !== selectedCaseId) {
    errors.push(`delta.target.caseId "${targetCaseId}" does not match selected case "${selectedCaseId}".`);
  }

  hasOnlyKeys(delta.operations, SUPPORTED_OPERATION_KEYS, "delta.operations", errors);

  const operations = delta.operations || {};
  const recordTargets = new Map();
  const groupSources = new Map();

  validateMoveRecords(operations.moveRecords, caseItem, errors, warnings, preview, recordTargets);
  validateRenameGroups(operations.renameGroups, caseItem, errors, warnings, preview, groupSources);
  validateMergeGroups(operations.mergeGroups, caseItem, errors, warnings, preview, groupSources);
  validateClearRecords(operations.clearRecords, caseItem, errors, warnings, preview, recordTargets);

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    preview,
    delta,
  };
}

export function applySequenceGroupDelta(caseItem, deltaInput) {
  const validation = validateSequenceGroupDelta(deltaInput, caseItem);
  if (!validation.ok) {
    return {
      ...validation,
      updatedCase: caseItem,
    };
  }

  const operations = validation.delta.operations || {};
  let updatedCase = caseItem;

  (operations.renameGroups || []).forEach((operation) => {
    updatedCase = renameCaseSequenceGroup(updatedCase, operation.fromGroup, operation.toGroup);
  });
  (operations.mergeGroups || []).forEach((operation) => {
    updatedCase = mergeCaseSequenceGroups(updatedCase, operation.fromGroup, operation.toGroup);
  });
  (operations.moveRecords || []).forEach((operation) => {
    updatedCase = moveRecordToSequenceGroup(updatedCase, operation.recordType, operation.recordId, operation.targetGroup);
  });
  (operations.clearRecords || []).forEach((operation) => {
    updatedCase = clearRecordSequenceGroup(updatedCase, operation.recordType, operation.recordId);
  });

  return {
    ...validation,
    updatedCase,
  };
}

export function ingestSequenceGroupDelta(deltaInput, caseItem, options = {}) {
  if (options.apply) return applySequenceGroupDelta(caseItem, deltaInput);
  return validateSequenceGroupDelta(deltaInput, caseItem);
}
