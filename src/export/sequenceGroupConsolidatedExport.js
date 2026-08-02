import { getCaseSequenceGroupDetails } from "../domain/caseDomain.js";
import { buildSequenceGroupAuditReport } from "./sequenceGroupAuditExport.js";
import { buildIssueIndex, getIssueDisplayLabel, resolveCaseIssue } from "../domain/issueDomain.js";

const RECORD_TYPES = ["incidents", "evidence", "documents", "strategy", "watchItems"];
const text = (value) => typeof value === "string" ? value.trim() : "";
const list = (value) => Array.isArray(value) ? value.filter((item) => typeof item === "string" && item.trim()) : [];
const dateOf = (record = {}) => record.eventDate || record.documentDate || record.date || record.capturedAt || record.createdAt || "";
const titleOf = (record = {}, type = "record") => record.title || record.name || record.label || record.id || `Untitled ${type}`;
const keyOf = (type, record) => `${type}:${record.id || titleOf(record, type)}`;

function resolvedGroups(caseData, meta = {}) {
  const details = getCaseSequenceGroupDetails(caseData);
  const groups = new Map(details.groups.map((group) => [group.name, group]));
  Object.keys(meta).forEach((name) => {
    if (!groups.has(name)) groups.set(name, { name, totalCount: 0, counts: {}, records: {}, warnings: { noIncidents: true, incidentsWithoutEvidence: false } });
  });
  return { details, groups: [...groups.values()].sort((a, b) => a.name.localeCompare(b.name)) };
}

function sortRecords(records = []) {
  return [...records].sort((a, b) => {
    const aPosition = Number(a.record.sequencePosition ?? a.record.position ?? a.record.order);
    const bPosition = Number(b.record.sequencePosition ?? b.record.position ?? b.record.order);
    if (Number.isFinite(aPosition) || Number.isFinite(bPosition)) return (Number.isFinite(aPosition) ? aPosition : Number.MAX_SAFE_INTEGER) - (Number.isFinite(bPosition) ? bPosition : Number.MAX_SAFE_INTEGER);
    return String(dateOf(a.record)).localeCompare(String(dateOf(b.record))) || String(a.record.createdAt || "").localeCompare(String(b.record.createdAt || "")) || titleOf(a.record, a.recordType).localeCompare(titleOf(b.record, b.recordType)) || String(a.record.id || "").localeCompare(String(b.record.id || ""));
  });
}

function attachmentMetadata(attachments) {
  return (Array.isArray(attachments) ? attachments : []).map((attachment) => ({
    id: attachment.id || "", name: attachment.name || attachment.filename || "", type: attachment.type || attachment.mimeType || "", size: attachment.size ?? null,
  }));
}

function exportRecord(record = {}, recordType, appearance, seen) {
  const reference = keyOf(recordType, record);
  const repeatedAppearance = seen.has(reference);
  seen.add(reference);
  return {
    reference, repeatedAppearance, appearance,
    recordType, id: record.id || "", title: titleOf(record, recordType), eventDate: dateOf(record), loggedDate: record.createdAt || "",
    description: record.description || record.summary || record.functionSummary || record.objective || record.watchFor || "",
    notes: record.notes || record.rationale || "", status: record.status || record.proofStatus || "", source: record.source || "",
    outcome: record.outcome || record.desiredOutcome || "",
    linkedPartyIds: list(record.linkedPartyIds), linkedIncidentIds: list(record.linkedIncidentIds), linkedEvidenceIds: list(record.linkedEvidenceIds),
    linkedDocumentIds: list(record.linkedDocumentIds), linkedStrategyIds: list(record.linkedStrategyIds), linkedWatchItemIds: list(record.linkedWatchItemIds),
    linkedRecordIds: list(record.linkedRecordIds), basedOnEvidenceIds: list(record.basedOnEvidenceIds), supportingRecordIds: list(record.supportingRecordIds),
    linkedIncidentRefs: (Array.isArray(record.linkedIncidentRefs) ? record.linkedIncidentRefs : []).map((ref) => ({ incidentId: ref?.incidentId || "", type: ref?.type || "" })),
    attachments: attachmentMetadata(record.attachments),
  };
}

function collectMissingReferences(caseData = {}, records = []) {
  const recordIds = new Set(RECORD_TYPES.flatMap((type) => (caseData[type] || []).map((record) => record.id).filter(Boolean)));
  const partyIds = new Set((caseData.parties || []).map((party) => party.id).filter(Boolean));
  const missing = [];
  records.forEach(({ record, recordType }) => {
    const source = keyOf(recordType, record);
    [...list(record.linkedRecordIds), ...list(record.linkedIncidentIds), ...list(record.linkedEvidenceIds), ...list(record.basedOnEvidenceIds), ...(record.linkedIncidentRefs || []).map((ref) => ref?.incidentId).filter(Boolean)].forEach((id) => {
      if (!recordIds.has(id)) missing.push({ source, kind: "record", technicalReference: id, message: `A linked record referenced by ${titleOf(record, recordType)} could not be resolved.` });
    });
    list(record.linkedPartyIds).forEach((id) => {
      if (!partyIds.has(id)) missing.push({ source, kind: "party", technicalReference: id, message: `A linked party referenced by ${titleOf(record, recordType)} could not be resolved.` });
    });
  });
  return missing;
}

function allCaseRecords(caseData = {}) {
  return RECORD_TYPES.flatMap((recordType) => (Array.isArray(caseData[recordType]) ? caseData[recordType] : []).filter((record) => record?.id).map((record) => ({ record, recordType })));
}

function groupStatus(group, audit) {
  if (group.totalCount === 0) return "metadata-only";
  if (audit.threadOverview.diagnosticCount > 0) return "needs-review";
  return "active";
}

export function buildAllSequenceGroupAuditsExport(caseData = {}, options = {}) {
  const sequenceGroupMeta = options.sequenceGroupMeta || {};
  const { groups } = resolvedGroups(caseData, sequenceGroupMeta);
  const audits = groups.map((group) => {
    const audit = buildSequenceGroupAuditReport(caseData, group.name, { sequenceGroupMeta });
    const seen = new Set();
    const records = sortRecords(allCaseRecords(caseData).filter(({ record }) => text(record.sequenceGroup) === group.name))
      .map(({ record, recordType }, index) => exportRecord(record, recordType, index + 1, seen));
    const issue = resolveCaseIssue(caseData, { issueName: group.name });
    return { issueId: issue?.id || null, issueReference: issue?.reference || null, issueName: issue?.name || group.name, issueDisplayLabel: issue ? getIssueDisplayLabel(issue) : group.name, name: group.name, description: text(issue?.description) || text(sequenceGroupMeta[group.name]?.description), state: group.totalCount === 0 ? "metadata-only" : "populated", status: groupStatus(group, audit), recordCount: group.totalCount, recordTypeBreakdown: { ...group.counts }, warnings: { ...group.warnings }, records, audit };
  });
  return {
    exportType: "ALL_SEQUENCE_GROUP_AUDITS", schemaVersion: "1.0", exportedAt: new Date().toISOString(), importable: false, includesBinaryData: false,
    case: { id: caseData.id || "", name: caseData.name || caseData.title || "", reference: caseData.reference || caseData.id || "" },
    issues: buildIssueIndex(caseData), totals: { sequenceGroups: audits.length, groupedRecords: audits.reduce((sum, group) => sum + group.recordCount, 0) }, audits,
  };
}

export function buildCaseBySequenceGroupsExport(caseData = {}, options = {}) {
  const sequenceGroupMeta = options.sequenceGroupMeta || {};
  const { groups } = resolvedGroups(caseData, sequenceGroupMeta);
  const allRecords = allCaseRecords(caseData);
  const seen = new Set();
  let appearances = 0;
  const sequenceGroups = groups.map((group) => {
    const grouped = sortRecords(allRecords.filter(({ record }) => text(record.sequenceGroup) === group.name));
    const records = grouped.map(({ record, recordType }) => exportRecord(record, recordType, ++appearances, seen));
    const audit = buildSequenceGroupAuditReport(caseData, group.name, { sequenceGroupMeta });
    const issue = resolveCaseIssue(caseData, { issueName: group.name });
    return { issueId: issue?.id || null, issueReference: issue?.reference || null, issueName: issue?.name || group.name, issueDisplayLabel: issue ? getIssueDisplayLabel(issue) : group.name, name: group.name, description: text(issue?.description) || text(sequenceGroupMeta[group.name]?.description), state: group.totalCount === 0 ? "metadata-only" : "populated", status: groupStatus(group, audit), counts: { ...group.counts, total: group.totalCount }, warnings: { ...group.warnings }, diagnostics: audit.diagnostics, records };
  });
  const ungrouped = Object.fromEntries(RECORD_TYPES.map((recordType) => [recordType, sortRecords(allRecords.filter((entry) => entry.recordType === recordType && !text(entry.record.sequenceGroup))).map(({ record }) => exportRecord(record, recordType, ++appearances, seen))]));
  const ungroupedTotal = Object.values(ungrouped).reduce((sum, records) => sum + records.length, 0);
  const recordTypeTotals = Object.fromEntries(RECORD_TYPES.map((recordType) => [recordType, allRecords.filter((entry) => entry.recordType === recordType).length]));
  return {
    exportType: "FULL_CASE_BY_SEQUENCE_GROUPS", schemaVersion: "1.0", exportedAt: new Date().toISOString(), importable: false, includesBinaryData: false,
    case: { id: caseData.id || "", name: caseData.name || caseData.title || "", reference: caseData.reference || caseData.id || "", description: caseData.description || caseData.summary || caseData.caseState?.currentSituation || "", status: caseData.status || "" },
    issues: buildIssueIndex(caseData),
    totals: { uniqueRecords: new Set(allRecords.map(({ record, recordType }) => keyOf(recordType, record))).size, groupedRecordAppearances: sequenceGroups.reduce((sum, group) => sum + group.records.length, 0), ungroupedRecords: ungroupedTotal, sequenceGroups: sequenceGroups.length, recordTypes: recordTypeTotals },
    sequenceGroups, ungroupedRecords: ungrouped, unresolvedReferences: collectMissingReferences(caseData, allRecords),
  };
}

const md = (value) => String(value ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
const recordLines = (records) => records.length ? records.map((record) => `- [${md(record.reference)}] ${md(record.eventDate || "No date")} | ${md(record.title)}${record.repeatedAppearance ? " | repeated appearance" : ""}\n  - status: ${md(record.status || "-")}; source: ${md(record.source || "-")}\n  - summary: ${md(record.description || "-")}\n  - notes: ${md(record.notes || "-")}\n  - attachments: ${record.attachments.map((item) => md(item.name || item.type || "metadata")).join(", ") || "None"}`).join("\n") : "- None";
const diagnosticLines = (diagnostics = {}) => {
  const lines = Object.entries(diagnostics).flatMap(([kind, items]) => (Array.isArray(items) ? items : []).map((item) => `- ${md(kind)}: ${md(item.message || item.title || item.id || JSON.stringify(item))}`));
  return lines.length ? lines : ["- None"];
};

export function exportAllSequenceGroupAuditsMarkdown(caseData, options = {}) {
  const report = buildAllSequenceGroupAuditsExport(caseData, options);
  return ["# All Sequence Group Audits", "", `Case: ${md(report.case.name || report.case.id)}`, `Case reference: ${md(report.case.reference)}`, `Exported: ${report.exportedAt}`, `Sequence groups: ${report.totals.sequenceGroups}`, `Grouped records: ${report.totals.groupedRecords}`, "", ...report.audits.flatMap((group) => [`## ${md(group.name)}`, `- State: ${group.state}`, `- Status: ${group.status}`, `- Description: ${md(group.description || "-")}`, `- Records: ${group.recordCount}`, `- Diagnostics: ${group.audit.threadOverview.diagnosticCount}`, `- Warnings: noIncidents=${group.warnings.noIncidents}; incidentsWithoutEvidence=${group.warnings.incidentsWithoutEvidence}`, `- Record types: ${Object.entries(group.recordTypeBreakdown).map(([type, count]) => `${type}=${count}`).join("; ")}`, "", "### Records", recordLines(group.records), "", "### Audit findings", ...diagnosticLines(group.audit.diagnostics), ""]),].join("\n");
}

export function exportCaseBySequenceGroupsMarkdown(caseData, options = {}) {
  const report = buildCaseBySequenceGroupsExport(caseData, options);
  return ["# Full Case by Sequence Groups", "", `Case: ${md(report.case.name || report.case.id)}`, `Case reference: ${md(report.case.reference)}`, `Description: ${md(report.case.description || "-")}`, `Exported: ${report.exportedAt}`, `Unique records: ${report.totals.uniqueRecords}`, `Grouped record appearances: ${report.totals.groupedRecordAppearances}`, `Ungrouped records: ${report.totals.ungroupedRecords}`, `Record types: ${Object.entries(report.totals.recordTypes).map(([type, count]) => `${type}=${count}`).join("; ")}`, "", ...report.sequenceGroups.flatMap((group) => [`## ${md(group.name)}`, `- State: ${group.state}`, `- Status: ${group.status}`, `- Description: ${md(group.description || "-")}`, `- Records: ${group.records.length}`, "", recordLines(group.records), "", "### Audit findings", ...diagnosticLines(group.diagnostics), ""]), "## Ungrouped Records", "", ...RECORD_TYPES.flatMap((type) => [`### ${type}`, recordLines(report.ungroupedRecords[type]), ""]), "## Unresolved and Missing References", "", ...(report.unresolvedReferences.length ? report.unresolvedReferences.map((item) => `- ${md(item.source)} | ${md(item.kind)} | ${md(item.message)} | technical reference: ${md(item.technicalReference)}`) : ["- None"]), ""].join("\n");
}
