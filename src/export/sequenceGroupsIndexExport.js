import {
  getCaseSequenceGroupDetails,
  getCaseSequenceGroupRelationshipMap,
} from "../domain/caseDomain.js";
import { resolveRecordById } from "../domain/linkingResolvers.js";

export const SEQUENCE_GROUPS_INDEX_PROMPT =
  "Please review this sequence group index and recommend which chains should be audited first, which appear weak or unsupported, and which records may need regrouping.";

const RECORD_TYPES = ["incidents", "evidence", "documents", "strategy"];

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function list(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string" && item.trim()) : [];
}

function slugify(value) {
  return text(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "sequence-group";
}

function getRecordDate(record = {}) {
  return record.eventDate || record.date || record.documentDate || record.capturedAt || record.createdAt || "";
}

function getRecordTitle(record = {}, recordType = "record") {
  if (recordType === "documents") return record.title || record.name || record.id || "Untitled document";
  return record.title || record.label || record.id || `Untitled ${recordType}`;
}

function getRecordStatus(record = {}) {
  return record.status || record.proofStatus || "";
}

function getTypeLabel(recordType) {
  if (recordType === "incidents") return "incident";
  if (recordType === "documents") return "document";
  return recordType;
}

function getLinks(record = {}) {
  return [
    ...list(record.linkedRecordIds),
    ...list(record.linkedEvidenceIds),
    ...list(record.linkedIncidentIds),
    ...list(record.basedOnEvidenceIds),
    ...(Array.isArray(record.linkedIncidentRefs) ? record.linkedIncidentRefs.map((ref) => ref?.incidentId).filter(Boolean) : []),
  ];
}

function getGroupedRecords(caseData = {}, groupName = "") {
  return RECORD_TYPES.flatMap((recordType) => {
    const records = Array.isArray(caseData[recordType]) ? caseData[recordType] : [];
    return records
      .filter((record) => text(record?.sequenceGroup) === groupName)
      .map((record) => ({ record, recordType }));
  });
}

function getSampleRecords(records = [], limit = 3) {
  return [...records]
    .sort((a, b) => String(getRecordDate(a.record)).localeCompare(String(getRecordDate(b.record))) || String(getRecordTitle(a.record, a.recordType)).localeCompare(String(getRecordTitle(b.record, b.recordType))))
    .slice(0, limit)
    .map(({ record, recordType }) => ({
      id: record.id || "",
      type: getTypeLabel(recordType),
      title: getRecordTitle(record, recordType),
      date: getRecordDate(record),
      status: getRecordStatus(record),
      evidenceStatus: record.evidenceStatus || "",
    }));
}

function getDateRange(records = []) {
  const dates = records.map(({ record }) => getRecordDate(record)).filter(Boolean).sort();
  return {
    firstDate: dates[0] || "",
    lastDate: dates[dates.length - 1] || "",
  };
}

function countExternalLinkedRecords(caseData, records, groupName) {
  const externalIds = new Set();

  records.forEach(({ record }) => {
    getLinks(record).forEach((id) => {
      const resolved = resolveRecordById(caseData, id);
      if (!resolved?.record) return;
      if (text(resolved.record.sequenceGroup) !== groupName) externalIds.add(id);
    });
  });

  return externalIds.size;
}

function getRecommendedUse({ counts, diagnostics }) {
  if (
    counts.incidents > 0 &&
    (diagnostics.noEvidence || diagnostics.needsEvidenceCount > 0 || diagnostics.milestoneWithoutEvidenceCount > 0 || diagnostics.weakOrUnlinkedCount > 0)
  ) {
    return "audit_first";
  }
  if (counts.incidents > 0 || counts.evidence > 0) return "supporting";
  return "low_priority";
}

function buildGroupIndexItem(caseData, group, sequenceGroupMeta = {}) {
  const groupName = text(group.name);
  const records = getGroupedRecords(caseData, groupName);
  const relationshipMap = getCaseSequenceGroupRelationshipMap(caseData, groupName);
  const needsEvidenceCount = records.filter(({ record, recordType }) =>
    recordType === "incidents" && record.evidenceStatus === "needs_evidence"
  ).length;
  const milestoneWithoutEvidenceCount = records.filter(({ record, recordType }) =>
    recordType === "incidents" && record.isMilestone && list(record.linkedEvidenceIds).length === 0
  ).length;
  const counts = {
    total: group.totalCount || 0,
    incidents: group.counts?.incidents || 0,
    evidence: group.counts?.evidence || 0,
    documents: group.counts?.documents || 0,
    strategy: group.counts?.strategy || 0,
  };
  const diagnostics = {
    noIncidents: counts.incidents === 0,
    noEvidence: counts.incidents > 0 && counts.evidence === 0,
    weakOrUnlinkedCount: relationshipMap.weakNodes.length,
    needsEvidenceCount,
    milestoneWithoutEvidenceCount,
    externalLinkedRecordCount: countExternalLinkedRecords(caseData, records, groupName),
  };

  return {
    name: groupName,
    slug: slugify(groupName),
    description: text(sequenceGroupMeta[groupName]?.description),
    counts,
    diagnostics,
    dateRange: getDateRange(records),
    sampleRecords: getSampleRecords(records),
    recommendedUse: getRecommendedUse({ counts, diagnostics }),
  };
}

function getUngroupedSummary(sequenceGroupDetails = {}) {
  const ungroupedRecords = sequenceGroupDetails.ungroupedRecords || {};
  const counts = {
    incidents: (ungroupedRecords.incidents || []).length,
    evidence: (ungroupedRecords.evidence || []).length,
    documents: (ungroupedRecords.documents || []).length,
    strategy: (ungroupedRecords.strategy || []).length,
  };
  counts.total = counts.incidents + counts.evidence + counts.documents + counts.strategy;

  const sampleRecords = RECORD_TYPES
    .flatMap((recordType) => (ungroupedRecords[recordType] || []).map((record) => ({
      id: record.id || "",
      type: getTypeLabel(recordType),
      title: record.title || "",
      date: record.date || "",
      status: record.status || "",
      evidenceStatus: "",
    })))
    .slice(0, 5);

  return {
    counts,
    sampleRecords,
  };
}

export function buildSequenceGroupsIndexReport(caseData = {}, options = {}) {
  const sequenceGroupDetails = getCaseSequenceGroupDetails(caseData);
  const sequenceGroups = sequenceGroupDetails.groups.map((group) => buildGroupIndexItem(caseData, group, options.sequenceGroupMeta || {}));
  const ungroupedSummary = getUngroupedSummary(sequenceGroupDetails);
  const totals = sequenceGroups.reduce((summary, group) => ({
    ...summary,
    groupedRecordCount: summary.groupedRecordCount + group.counts.total,
    incidentCount: summary.incidentCount + group.counts.incidents,
    evidenceCount: summary.evidenceCount + group.counts.evidence,
    documentCount: summary.documentCount + group.counts.documents,
    strategyCount: summary.strategyCount + group.counts.strategy,
  }), {
    sequenceGroupCount: sequenceGroups.length,
    groupedRecordCount: 0,
    ungroupedRecordCount: ungroupedSummary.counts.total,
    incidentCount: 0,
    evidenceCount: 0,
    documentCount: 0,
    strategyCount: 0,
  });

  return {
    exportType: "SEQUENCE_GROUPS_INDEX_REPORT",
    schemaVersion: "1.0",
    exportedAt: new Date().toISOString(),
    importable: false,
    case: {
      id: caseData?.id || "",
      title: caseData?.title || caseData?.name || "",
      reference: caseData?.reference || caseData?.id || "",
      status: caseData?.status || "",
    },
    totals,
    sequenceGroups,
    ungroupedSummary,
    gptPromptBlock: SEQUENCE_GROUPS_INDEX_PROMPT,
  };
}

function mdEscape(value) {
  return text(value).replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function mdList(items, formatter) {
  if (!items || items.length === 0) return "- None";
  return items.map(formatter).join("\n");
}

export function exportSequenceGroupsIndexJson(caseData, options = {}) {
  return buildSequenceGroupsIndexReport(caseData, options);
}

export function exportSequenceGroupsIndexMarkdown(caseData, options = {}) {
  const report = buildSequenceGroupsIndexReport(caseData, options);
  const lines = [
    "# Sequence Groups Index Report",
    "",
    "## Case",
    "",
    `- ID: ${mdEscape(report.case.id) || "-"}`,
    `- Title: ${mdEscape(report.case.title) || "-"}`,
    `- Reference: ${mdEscape(report.case.reference) || "-"}`,
    `- Status: ${mdEscape(report.case.status) || "-"}`,
    "",
    "## Totals",
    "",
    `- Sequence groups: ${report.totals.sequenceGroupCount}`,
    `- Grouped records: ${report.totals.groupedRecordCount}`,
    `- Ungrouped records: ${report.totals.ungroupedRecordCount}`,
    `- Incidents: ${report.totals.incidentCount}`,
    `- Evidence: ${report.totals.evidenceCount}`,
    `- Documents: ${report.totals.documentCount}`,
    `- Strategy: ${report.totals.strategyCount}`,
    "",
    "## Sequence Groups",
    "",
    mdList(report.sequenceGroups, (group) => [
      `### ${mdEscape(group.name)}`,
      "",
      `- Description: ${mdEscape(group.description) || "-"}`,
      `- Counts: ${group.counts.total} total; ${group.counts.incidents} incidents; ${group.counts.evidence} evidence; ${group.counts.documents} docs; ${group.counts.strategy} strategy`,
      `- Date range: ${group.dateRange.firstDate || "-"} to ${group.dateRange.lastDate || "-"}`,
      `- Warnings/diagnostics: noIncidents=${group.diagnostics.noIncidents}; noEvidence=${group.diagnostics.noEvidence}; weakOrUnlinked=${group.diagnostics.weakOrUnlinkedCount}; needsEvidence=${group.diagnostics.needsEvidenceCount}; milestoneWithoutEvidence=${group.diagnostics.milestoneWithoutEvidenceCount}; externalLinkedRecords=${group.diagnostics.externalLinkedRecordCount}`,
      "- Sample records:",
      mdList(group.sampleRecords, (record) => `  - ${record.id} | ${record.type} | ${record.date || "No date"} | ${mdEscape(record.title)} | ${record.status || "-"}`),
      `- Recommended use: ${group.recommendedUse}`,
    ].join("\n")),
    "",
    "## Ungrouped Records",
    "",
    `- Counts: ${report.ungroupedSummary.counts.total} total; ${report.ungroupedSummary.counts.incidents} incidents; ${report.ungroupedSummary.counts.evidence} evidence; ${report.ungroupedSummary.counts.documents} docs; ${report.ungroupedSummary.counts.strategy} strategy`,
    "- Sample records:",
    mdList(report.ungroupedSummary.sampleRecords, (record) => `  - ${record.id} | ${record.type} | ${record.date || "No date"} | ${mdEscape(record.title)} | ${record.status || "-"}`),
    "",
    "## GPT Review Prompt",
    "",
    report.gptPromptBlock,
    "",
  ];

  return lines.join("\n");
}
