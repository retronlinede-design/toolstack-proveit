import { analyzeCaseDiagnostics } from "../diagnostics/caseDiagnostics.js";
import { getCaseSequenceGroupDetails } from "../domain/caseDomain.js";
import { buildSequenceGroupAuditReport } from "../export/sequenceGroupAuditExport.js";
import { getIssueDisplayLabel, normalizeCaseIssues } from "../domain/issueDomain.js";
import {
  compareReportChronology,
  projectReportRecord,
} from "./reportRecordUtils.js";

export const REPORT_MODEL_SCHEMA_VERSION = 1;

export const REPORT_MODEL_RECORD_TYPES = Object.freeze([
  { type: "incident", collection: "incidents" },
  { type: "evidence", collection: "evidence" },
  { type: "document", collection: "documents" },
  { type: "ledger", collection: "ledger" },
  { type: "strategy", collection: "strategy" },
  { type: "watch", collection: "watchItems" },
]);

const UI_ONLY_KEYS = new Set([
  "activeTab", "selectedTab", "selectedRecordId", "previewState", "clipboardFeedback",
  "generatedReportText", "generatedReportVersions", "managementReportPolishDraft", "reportDisplayLanguage",
]);

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normaliseGroup(value) {
  return text(value).toLocaleLowerCase();
}

function recordReference(record) {
  return `${record.type}:${record.id || `source-${record.sourceIndex}`}`;
}

function stableValue(value, seen = new WeakSet()) {
  if (value == null || ["string", "number", "boolean"].includes(typeof value)) return value;
  if (typeof value !== "object" || seen.has(value)) return undefined;
  seen.add(value);
  if (Array.isArray(value)) {
    const result = value.map((item) => stableValue(item, seen)).filter((item) => item !== undefined);
    seen.delete(value);
    return result;
  }
  const result = {};
  for (const key of Object.keys(value).sort()) {
    if (UI_ONLY_KEYS.has(key)) continue;
    const next = stableValue(value[key], seen);
    if (next !== undefined) result[key] = next;
  }
  seen.delete(value);
  return result;
}

function stableStringify(value) {
  return JSON.stringify(stableValue(value));
}

function lightweightHash(value) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function projectParties(caseData) {
  return (Array.isArray(caseData.parties) ? caseData.parties : [])
    .filter((party) => party && typeof party === "object")
    .map((party) => ({
      id: text(party.id),
      name: text(party.displayName) || text(party.legalName) || text(party.name),
      role: text(party.role) || text(party.relationshipRole) || text(party.jobTitle),
      organisation: text(party.organisation) || text(party.organization),
      status: text(party.status),
    }))
    .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
}

function collectRecords(caseData, includeArchived) {
  const records = [];
  const seen = new Set();
  for (const { type, collection } of REPORT_MODEL_RECORD_TYPES) {
    const source = Array.isArray(caseData[collection]) ? caseData[collection] : [];
    source.forEach((record, sourceIndex) => {
      if (!record || typeof record !== "object") return;
      const projected = projectReportRecord(record, type, { sourceIndex });
      const key = projected.id ? `${type}:${projected.id}` : `${type}:source-${sourceIndex}`;
      if (seen.has(key) || (!includeArchived && projected.archived)) return;
      seen.add(key);
      records.push(projected);
    });
  }
  return records;
}

function resolveReferences(records, parties) {
  const recordById = new Map();
  records.forEach((record) => {
    if (record.id && !recordById.has(record.id)) recordById.set(record.id, record);
  });
  const partyById = new Map(parties.filter((party) => party.id).map((party) => [party.id, party]));
  const unresolved = new Map();

  const resolvedRecords = records.map((record) => {
    const links = record.linkReferences.map(({ targetId, referenceType }) => {
      const target = recordById.get(targetId);
      if (target) return { targetId, targetType: target.type, targetTitle: target.title, referenceType, status: "resolved" };
      const key = `${recordReference(record)}:record:${targetId}`;
      unresolved.set(key, {
        sourceRecordId: record.id,
        sourceRecordType: record.type,
        targetId,
        referenceType: "record",
        message: `A linked record referenced by ${record.title} could not be resolved.`,
      });
      return { targetId, targetType: "", targetTitle: "Unresolved record", referenceType, status: "unresolved" };
    });
    const resolvedParties = record.partyIds.map((partyId) => {
      const party = partyById.get(partyId);
      if (party) return { id: party.id, name: party.name, role: party.role };
      const key = `${recordReference(record)}:party:${partyId}`;
      unresolved.set(key, {
        sourceRecordId: record.id,
        sourceRecordType: record.type,
        targetId: partyId,
        referenceType: "party",
        message: `A linked party referenced by ${record.title} could not be resolved.`,
      });
      return { id: partyId, name: "", role: "", unresolved: true };
    });
    return { ...record, links, resolvedParties };
  });

  return { records: resolvedRecords, unresolvedReferences: [...unresolved.values()] };
}

function buildGroups(caseData, records, sequenceGroupMeta, includeDiagnostics) {
  const domainDetails = getCaseSequenceGroupDetails(caseData);
  const definitions = new Map();
  (caseData.issues || []).forEach((issue) => definitions.set(normaliseGroup(issue.name), { name: issue.name, issue, registered: true, inferred: false }));
  domainDetails.groups.forEach((group) => {
    const key = normaliseGroup(group.name);
    definitions.set(key, { ...(definitions.get(key) || {}), name: group.name, inferred: true });
  });
  Object.keys(sequenceGroupMeta).forEach((name) => definitions.set(normaliseGroup(name), {
    ...(definitions.get(normaliseGroup(name)) || {}),
    name,
    registered: true,
    inferred: definitions.has(normaliseGroup(name)),
  }));
  records.forEach((record) => {
    if (!record.sequenceGroup) return;
    const key = normaliseGroup(record.sequenceGroup);
    if (!definitions.has(key)) definitions.set(key, { name: record.sequenceGroup, registered: false, inferred: true });
  });

  const groups = [...definitions.values()]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((definition, order) => {
      const matching = records.filter((record) => normaliseGroup(record.sequenceGroup) === normaliseGroup(definition.name));
      const recordsByType = Object.fromEntries(REPORT_MODEL_RECORD_TYPES.map(({ type }) => [type, matching.filter((record) => record.type === type).map(recordReference)]));
      const totalsByType = Object.fromEntries(REPORT_MODEL_RECORD_TYPES.map(({ type }) => [type, recordsByType[type].length]));
      const description = text(sequenceGroupMeta[definition.name]?.description)
        || text(Object.entries(sequenceGroupMeta).find(([name]) => normaliseGroup(name) === normaliseGroup(definition.name))?.[1]?.description);
      return {
        id: definition.issue?.id || definition.name,
        issueId: definition.issue?.id || null,
        issueReference: definition.issue?.reference || null,
        issueName: definition.name,
        displayLabel: definition.issue ? getIssueDisplayLabel(definition.issue) : definition.name,
        name: definition.name,
        description: text(definition.issue?.description) || description,
        purpose: text(definition.issue?.purpose),
        status: definition.issue?.status || null,
        priority: definition.issue?.priority || null,
        ownerPartyId: definition.issue?.ownerPartyId || null,
        reviewDate: definition.issue?.reviewDate || null,
        currentPosition: text(definition.issue?.currentPosition),
        order,
        registered: definition.registered,
        inferred: definition.inferred,
        metadataOnly: definition.registered && matching.length === 0,
        empty: matching.length === 0,
        totals: { uniqueRecordCount: new Set(matching.map(recordReference)).size, byType: totalsByType },
        recordIds: matching.map(recordReference),
        recordsByType,
        diagnostics: includeDiagnostics ? buildSequenceGroupAuditReport(caseData, definition.name, { sequenceGroupMeta }).diagnostics : null,
      };
    });

  return { groups, domainUngrouped: domainDetails.ungroupedRecords };
}

function buildChronology(records) {
  return [...records].sort(compareReportChronology).map((record) => ({
    recordId: record.id,
    recordType: record.type,
    date: record.canonicalDate,
    dateStatus: record.dateStatus,
    title: record.title,
    summary: record.summary,
    sequenceGroup: record.sequenceGroup,
    archived: record.archived,
  }));
}

function byType(records) {
  return Object.fromEntries(REPORT_MODEL_RECORD_TYPES.map(({ type }) => [type, records.filter((record) => record.type === type)]));
}

export function buildCaseReportModel(caseData, options = {}) {
  const rawSource = caseData && typeof caseData === "object" && !Array.isArray(caseData) ? caseData : {};
  const includeArchived = options.includeArchived !== false;
  const includeDiagnostics = options.includeDiagnostics !== false;
  const sequenceGroupMeta = options.sequenceGroupMeta && typeof options.sequenceGroupMeta === "object" ? options.sequenceGroupMeta : {};
  const source = normalizeCaseIssues(rawSource, { sequenceGroupMeta }).caseData;
  const requestedScope = options.scope === "sequenceGroup" ? "sequenceGroup" : "case";
  const requestedGroup = requestedScope === "sequenceGroup" ? text(options.sequenceGroupName) : "";
  const requestedIssueId = requestedScope === "sequenceGroup" ? text(options.issueId) : "";
  const parties = projectParties(source);
  const projected = collectRecords(source, includeArchived);
  const resolved = resolveReferences(projected, parties);
  const allRecords = resolved.records;
  const revisionRecords = includeArchived
    ? allRecords
    : resolveReferences(collectRecords(source, true), parties).records;
  const { groups } = buildGroups(source, allRecords, sequenceGroupMeta, includeDiagnostics);
  const selectedGroup = requestedScope === "sequenceGroup"
    ? groups.find((group) => requestedIssueId ? group.issueId === requestedIssueId : normaliseGroup(group.name) === normaliseGroup(requestedGroup))
    : null;
  const scopeIsValid = requestedScope === "case" || Boolean(selectedGroup);
  const primaryScopedRecords = requestedScope === "case"
    ? allRecords
    : scopeIsValid ? allRecords.filter((record) => normaliseGroup(record.sequenceGroup) === normaliseGroup(selectedGroup.name)) : [];
  const scopedReferences = new Set(primaryScopedRecords.map(recordReference));
  const scopedUnresolved = resolved.unresolvedReferences.filter((item) => {
    if (requestedScope === "case") return true;
    return primaryScopedRecords.some((record) => record.id === item.sourceRecordId && record.type === item.sourceRecordType);
  });
  const groupedRecords = allRecords.filter((record) => record.sequenceGroup);
  const ungroupedRecords = allRecords.filter((record) => !record.sequenceGroup);
  const attachmentCount = primaryScopedRecords.reduce((sum, record) => sum + record.attachmentMetadata.length, 0);
  const recordTypeTotals = Object.fromEntries(REPORT_MODEL_RECORD_TYPES.map(({ type }) => [type, primaryScopedRecords.filter((record) => record.type === type).length]));
  const sourceCase = {
    id: text(source.id),
    name: text(source.name) || text(source.title),
    category: text(source.category),
    status: text(source.status),
    createdAt: text(source.createdAt),
    updatedAt: text(source.updatedAt),
  };
  const fingerprintInput = {
    sourceCase,
    records: revisionRecords,
    parties,
    sequenceGroupMeta: stableValue(sequenceGroupMeta),
  };

  return {
    schemaVersion: REPORT_MODEL_SCHEMA_VERSION,
    generatedAt: options.generatedAt || new Date().toISOString(),
    sourceCase,
    sourceRevision: {
      caseUpdatedAt: sourceCase.updatedAt,
      recordCount: revisionRecords.length,
      fingerprint: lightweightHash(stableStringify(fingerprintInput)),
    },
    scope: {
      type: requestedScope,
      sequenceGroupName: requestedScope === "sequenceGroup" ? requestedGroup : null,
      issueId: selectedGroup?.issueId || null,
      issueReference: selectedGroup?.issueReference || null,
      issueName: selectedGroup?.issueName || (requestedScope === "sequenceGroup" ? requestedGroup : null),
      displayLabel: selectedGroup?.displayLabel || (requestedScope === "sequenceGroup" ? requestedGroup : "Whole case"),
      isValid: scopeIsValid,
    },
    totals: {
      uniqueRecordCount: new Set(allRecords.map(recordReference)).size,
      scopedRecordCount: scopedReferences.size,
      byType: recordTypeTotals,
      archivedRecordCount: primaryScopedRecords.filter((record) => record.archived).length,
      activeRecordCount: primaryScopedRecords.filter((record) => !record.archived).length,
      groupedUniqueRecordCount: new Set(groupedRecords.map(recordReference)).size,
      groupAppearanceCount: groups.reduce((sum, group) => sum + group.recordIds.length, 0),
      ungroupedRecordCount: ungroupedRecords.length,
      sequenceGroupCount: groups.length,
      emptyGroupCount: groups.filter((group) => group.empty).length,
      metadataOnlyGroupCount: groups.filter((group) => group.metadataOnly).length,
      unresolvedReferenceCount: scopedUnresolved.length,
      attachmentMetadataCount: attachmentCount,
    },
    records: {
      all: allRecords,
      primaryScopedRecords,
      byType: byType(primaryScopedRecords),
    },
    chronology: buildChronology(primaryScopedRecords),
    sequenceGroups: groups,
    ungroupedRecords,
    parties,
    unresolvedReferences: scopedUnresolved,
    diagnostics: includeDiagnostics ? {
      case: analyzeCaseDiagnostics(source),
      sequenceGroups: Object.fromEntries(groups.map((group) => [group.name, group.diagnostics])),
      records: {
        coverageNote: "Existing case diagnostics primarily cover incidents, evidence, documents, ledger, strategy, and registered chronology fields; Watch coverage is limited to the diagnostics currently implemented.",
      },
    } : { case: null, sequenceGroups: {}, records: {} },
  };
}
