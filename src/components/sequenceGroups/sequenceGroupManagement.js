import {
  removeCaseSequenceGroup,
  renameCaseSequenceGroup,
} from "../../domain/caseDomain.js";
import {
  deleteSequenceGroupMeta,
  renameSequenceGroupMeta,
  saveSequenceGroupMeta,
} from "../../sequenceGroupMeta.js";

export function normalizeSequenceGroupInput(value = {}) {
  return {
    name: typeof value.name === "string" ? value.name.trim() : "",
    description: typeof value.description === "string" ? value.description.trim() : "",
  };
}

export function validateSequenceGroupInput(value, existingNames = [], currentName = "") {
  const normalized = normalizeSequenceGroupInput(value);
  if (!normalized.name) return { value: normalized, error: "Name is required." };
  const duplicate = existingNames.some((name) => (
    name !== currentName && name.localeCompare(normalized.name, undefined, { sensitivity: "accent" }) === 0
  ));
  if (duplicate) return { value: normalized, error: "A sequence group with this name already exists." };
  return { value: normalized, error: "" };
}

export function createManagedSequenceGroup(caseId, value, storage) {
  const normalized = normalizeSequenceGroupInput(value);
  saveSequenceGroupMeta(caseId, normalized.name, { description: normalized.description }, storage);
  return normalized;
}

export function updateManagedSequenceGroup(caseItem, currentName, value, storage, persistMeta = true) {
  const normalized = normalizeSequenceGroupInput(value);
  const renamedCase = normalized.name === currentName
    ? caseItem
    : renameCaseSequenceGroup(caseItem, currentName, normalized.name);

  if (persistMeta && normalized.name !== currentName) {
    renameSequenceGroupMeta(caseItem.id, currentName, normalized.name, storage);
  }
  if (persistMeta) saveSequenceGroupMeta(caseItem.id, normalized.name, { description: normalized.description }, storage);
  return { caseItem: renamedCase, group: normalized };
}

export function deleteManagedSequenceGroup(caseItem, groupName, storage, persistMeta = true) {
  const updatedCase = removeCaseSequenceGroup(caseItem, groupName);
  if (persistMeta) deleteSequenceGroupMeta(caseItem.id, groupName, storage);
  return updatedCase;
}

export function mergeManagedSequenceGroupDetails(sequenceGroupDetails = {}, sequenceGroupMeta = {}) {
  const groups = new Map((sequenceGroupDetails.groups || []).map((group) => [group.name, group]));
  Object.keys(sequenceGroupMeta).forEach((name) => {
    if (groups.has(name)) return;
    groups.set(name, {
      name,
      totalCount: 0,
      counts: { incidents: 0, evidence: 0, documents: 0, strategy: 0 },
      records: { incidents: [], evidence: [], documents: [], strategy: [], watchItems: [] },
      warnings: { noIncidents: true, incidentsWithoutEvidence: false },
    });
  });
  return {
    ...sequenceGroupDetails,
    groups: [...groups.values()].sort((a, b) => a.name.localeCompare(b.name)),
  };
}
