import { analyzeCaseDiagnostics } from "../diagnostics/caseDiagnostics.js";
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

// Shared canonical-first resolver for report builders. Consumers that only have
// projected report records can supply those records in the normal collections.
export function createReportIssueMembershipResolver(caseData = {}) {
  const activeIssues = Array.isArray(caseData.issues) ? caseData.issues.filter((issue) => text(issue?.id)) : [];
  const issuesById = new Map();
  const issuesByName = new Map();
  const retiredIds = new Set((Array.isArray(caseData.retiredIssues) ? caseData.retiredIssues : []).map((issue) => text(issue?.id)).filter(Boolean));
  const retiredNames = new Set((Array.isArray(caseData.retiredIssues) ? caseData.retiredIssues : []).map((issue) => normaliseGroup(issue?.name)).filter(Boolean));
  const sourceRecords = new Map();

  activeIssues.forEach((issue) => {
    const byId = issuesById.get(issue.id) || [];
    byId.push(issue);
    issuesById.set(issue.id, byId);
    const key = normaliseGroup(issue.name);
    if (!key) return;
    const byName = issuesByName.get(key) || [];
    byName.push(issue);
    issuesByName.set(key, byName);
  });

  REPORT_MODEL_RECORD_TYPES.forEach(({ type, collection }) => {
    (Array.isArray(caseData[collection]) ? caseData[collection] : []).forEach((record) => {
      if (text(record?.id)) sourceRecords.set(`${type}:${text(record.id)}`, record);
    });
  });

  function resolve(record = {}) {
    const sourceRecord = sourceRecords.get(`${record.type}:${record.id}`) || record;
    const explicitIssueId = text(sourceRecord.sequenceGroupId);
    if (explicitIssueId) {
      const matches = issuesById.get(explicitIssueId) || [];
      return matches.length === 1
        ? { kind: "canonical", issue: matches[0] }
        : { kind: retiredIds.has(explicitIssueId) ? "retired" : "invalid-id" };
    }

    const legacyName = text(sourceRecord.sequenceGroup);
    const key = normaliseGroup(legacyName);
    if (!key) return { kind: "unassigned" };
    if (retiredNames.has(key)) return { kind: "retired" };
    const matches = issuesByName.get(key) || [];
    if (matches.length === 1) return { kind: "canonical", issue: matches[0], legacyFallback: true };
    if (matches.length > 1) return { kind: "ambiguous-legacy-name", name: legacyName };
    return { kind: "legacy", name: legacyName };
  }

  return { activeIssues, retiredNames, resolve };
}

function buildGroups(originalCaseData, records, sequenceGroupMeta, includeDiagnostics) {
  const membership = createReportIssueMembershipResolver(originalCaseData);
  const definitions = membership.activeIssues.map((issue) => ({
    key: `issue:${issue.id}`,
    name: issue.name,
    issue,
    registered: true,
    inferred: false,
  }));
  const legacyDefinitions = new Map();
  const addLegacyDefinition = (name, registered = false) => {
    const key = normaliseGroup(name);
    if (!key || membership.retiredNames.has(key) || (membership.activeIssues.filter((issue) => normaliseGroup(issue.name) === key).length > 0)) return;
    const existing = legacyDefinitions.get(key);
    legacyDefinitions.set(key, { key: `legacy:${key}`, name: text(name), issue: null, registered: registered || existing?.registered || false, inferred: Boolean(existing) || !registered });
  };
  Object.keys(sequenceGroupMeta).forEach((name) => addLegacyDefinition(name, true));
  records.forEach((record) => {
    const resolved = membership.resolve(record);
    if (resolved.kind === "legacy") addLegacyDefinition(resolved.name);
  });
  definitions.push(...legacyDefinitions.values());

  const groups = definitions
    .sort((a, b) => a.name.localeCompare(b.name) || String(a.issue?.id || "").localeCompare(String(b.issue?.id || "")))
    .map((definition, order) => {
      const matching = records.filter((record) => {
        const resolved = membership.resolve(record);
        return definition.issue
          ? resolved.kind === "canonical" && resolved.issue.id === definition.issue.id
          : resolved.kind === "legacy" && normaliseGroup(resolved.name) === normaliseGroup(definition.name);
      });
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
        createdAt: text(definition.issue?.createdAt),
        updatedAt: text(definition.issue?.updatedAt),
        order,
        registered: definition.registered,
        inferred: definition.inferred,
        metadataOnly: definition.registered && matching.length === 0,
        empty: matching.length === 0,
        totals: { uniqueRecordCount: new Set(matching.map(recordReference)).size, byType: totalsByType },
        recordIds: matching.map(recordReference),
        recordsByType,
        diagnostics: includeDiagnostics ? buildSequenceGroupAuditReport(originalCaseData, definition.name, {
          sequenceGroupMeta,
          ...(definition.issue ? { issueId: definition.issue.id } : {}),
        }).diagnostics : null,
      };
    });

  return { groups, membership };
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
  const { groups, membership } = buildGroups(rawSource, allRecords, sequenceGroupMeta, includeDiagnostics);
  const selectedGroup = requestedScope === "sequenceGroup"
    ? groups.find((group) => requestedIssueId ? group.issueId === requestedIssueId : normaliseGroup(group.name) === normaliseGroup(requestedGroup))
    : null;
  const scopeIsValid = requestedScope === "case" || Boolean(selectedGroup);
  const primaryScopedRecords = requestedScope === "case"
    ? allRecords
    : scopeIsValid ? allRecords.filter((record) => {
      const resolved = membership.resolve(record);
      return selectedGroup.issueId
        ? resolved.kind === "canonical" && resolved.issue.id === selectedGroup.issueId
        : resolved.kind === "legacy" && normaliseGroup(resolved.name) === normaliseGroup(selectedGroup.name);
    }) : [];
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
    issues: stableValue(source.issues || []),
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
