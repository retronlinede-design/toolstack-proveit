import { EVIDENCE_PACK_REPORT } from "./reportBuilder.js";

function linkedDisplay(recordByReference, link) {
  const target = [...recordByReference.values()].find((record) => record.id === link.targetId);
  if (!target) return { id: link.targetId, recordType: "unknown", title: link.targetId, status: "missing" };
  return {
    id: target.id,
    recordType: target.type,
    title: target.title,
    status: "resolved",
  };
}

function buildEvidenceItem(record, recordByReference) {
  const linkedRecords = record.links
    .filter((link) => ["linkedRecordIds", "linkedEvidenceIds"].includes(link.referenceType))
    .map((link) => linkedDisplay(recordByReference, link))
    .filter(Boolean);
  const explicitIncidents = record.links
    .filter((link) => ["linkedIncidentIds", "linkedIncidentRefs"].includes(link.referenceType))
    .map((link) => linkedDisplay(recordByReference, link))
    .filter(Boolean);
  const reverseIncidents = [...recordByReference.values()]
    .filter((candidate) => candidate.type === "incident" && candidate.linkedRecordIds.includes(record.id))
    .map((candidate) => ({ id: candidate.id, recordType: candidate.type, title: candidate.title, status: "resolved" }));
  const linkedIncidents = [...new Map([...explicitIncidents, ...linkedRecords.filter((item) => item.recordType === "incident"), ...reverseIncidents].map((item) => [item.id, item])).values()];
  const attachmentNames = record.attachmentMetadata.map((attachment) => attachment.filename).filter(Boolean);
  return {
    id: record.id,
    title: record.title,
    date: record.eventDate,
    capturedAt: record.details.capturedAt || record.loggedDate,
    status: record.status,
    evidenceRole: record.details.evidenceRole || "",
    functionSummary: record.details.functionSummary || record.summary,
    linkedIncidents,
    linkedRecords,
    attachmentNames,
    attachmentCount: attachmentNames.length,
    reviewNotes: record.notes,
  };
}

export function buildEvidencePackReportFromModel(model, options = {}) {
  const safeModel = model && typeof model === "object" ? model : {};
  const allRecords = safeModel.records?.all || [];
  const primaryRecords = safeModel.records?.primaryScopedRecords || [];
  const primaryThreadRecords = primaryRecords.filter((record) => record.type !== "ledger");
  const primaryIds = new Set(primaryThreadRecords.map((record) => record.id));
  const directlyLinkedIds = new Set(primaryThreadRecords.flatMap((record) => record.linkedRecordIds || []));
  const evidenceRecords = safeModel.scope?.type === "sequenceGroup"
    ? allRecords.filter((record) => record.type === "evidence" && (
      primaryIds.has(record.id)
      || directlyLinkedIds.has(record.id)
      || (record.linkedRecordIds || []).some((id) => primaryIds.has(id))
    ))
    : safeModel.records?.byType?.evidence || [];
  const recordByReference = new Map(allRecords.map((record) => [`${record.type}:${record.id}`, record]));
  const evidenceMatrix = evidenceRecords.map((record) => buildEvidenceItem(record, recordByReference));
  const linkedEvidence = evidenceMatrix.filter((item) => item.linkedIncidents.length > 0);
  const evidenceMissingFunctionSummary = evidenceMatrix.filter((item) => !item.functionSummary.trim());
  const evidenceWithAttachments = evidenceMatrix.filter((item) => item.attachmentCount > 0);
  const unlinkedEvidence = evidenceMatrix.filter((item) => item.linkedIncidents.length === 0);
  const evidenceWithoutAttachments = evidenceMatrix.filter((item) => item.attachmentCount === 0);
  const evidenceIds = new Set(evidenceRecords.map((record) => record.id));
  const supportedIncidents = (safeModel.records?.all || [])
    .filter((record) => record.type === "incident")
    .map((incident) => {
      const linked = evidenceMatrix.filter((evidence) => evidence.linkedIncidents.some((item) => item.id === incident.id));
      return {
        id: incident.id,
        title: incident.title,
        evidenceStatus: incident.details.evidenceStatus || "",
        linkedEvidence: linked.map((item) => ({ id: item.id, title: item.title })),
        remainsUnsupported: linked.length === 0 || ["needs_evidence", "unverified"].includes(incident.details.evidenceStatus),
      };
    })
    .filter((incident) => incident.linkedEvidence.length > 0);
  const diagnostics = safeModel.diagnostics?.case || {};
  const incidentIds = new Set(supportedIncidents.map((incident) => incident.id));
  const scopeType = safeModel.scope?.type === "sequenceGroup" ? "sequenceGroup" : "case";
  const sequenceGroup = scopeType === "sequenceGroup" ? safeModel.scope?.sequenceGroupName || "" : "";

  return {
    reportType: EVIDENCE_PACK_REPORT,
    title: scopeType === "sequenceGroup" ? `Evidence Pack: ${sequenceGroup || "Unselected sequenceGroup"}` : "Evidence Pack: Whole Case",
    audience: "general",
    scopeType,
    sequenceGroup,
    scopeLabel: scopeType === "sequenceGroup" ? `sequenceGroup: ${sequenceGroup || "-"}` : "Whole case",
    sourceCaseId: safeModel.sourceCase?.id || "",
    generatedAt: options.generatedAt || safeModel.generatedAt || new Date().toISOString(),
    includedEvidenceCount: evidenceRecords.length,
    includedEvidenceIds: evidenceRecords.map((record) => record.id),
    caseOverview: {
      name: safeModel.sourceCase?.name || "",
      category: safeModel.sourceCase?.category || "",
      status: safeModel.sourceCase?.status || "",
    },
    atAGlance: {
      evidenceCount: evidenceRecords.length,
      linkedEvidenceCount: linkedEvidence.length,
      unlinkedEvidenceCount: unlinkedEvidence.length,
      incidentsSupportedCount: supportedIncidents.length,
      evidenceWithAttachmentsCount: evidenceWithAttachments.length,
      evidenceMissingFunctionSummaryCount: evidenceMissingFunctionSummary.length,
    },
    evidenceMatrix,
    supportedIncidents,
    unlinkedWeakEvidence: { unlinkedEvidence, evidenceMissingFunctionSummary, evidenceWithoutAttachments },
    diagnostics: {
      unusedEvidence: (diagnostics.evidenceCoverage?.unusedEvidence || []).filter((item) => evidenceIds.has(item.id)),
      weaklyLinkedEvidence: (diagnostics.integrity?.weaklyLinkedRecords || []).filter((item) => item.type === "evidence" && evidenceIds.has(item.id)),
      brokenLinks: (diagnostics.integrity?.brokenLinks || []).filter((link) => evidenceIds.has(link.sourceId) || evidenceIds.has(link.targetId)),
      unsupportedIncidents: (diagnostics.evidenceCoverage?.incidentsNeedingEvidence || []).filter((item) => incidentIds.has(item.id)),
      warnings: diagnostics.warnings || [],
      suggestions: diagnostics.suggestions || [],
    },
  };
}
