import { buildEvidencePackReportFromModel } from "./evidencePackModelAdapter.js";
import { createReportDocument, getReportDocumentSection } from "./reportDocument.js";

function evidenceRecordById(model) {
  return new Map((model?.records?.all || []).filter((record) => record.type === "evidence").map((record) => [record.id, record]));
}

function incidentRecordById(model) {
  return new Map((model?.records?.all || []).filter((record) => record.type === "incident").map((record) => [record.id, record]));
}

export function buildEvidenceScheduleDocument(reportModel, definition, options = {}) {
  const model = reportModel && typeof reportModel === "object" ? reportModel : {};
  const legacy = buildEvidencePackReportFromModel(model, { generatedAt: options.generatedAt });
  const evidenceById = evidenceRecordById(model);
  const incidentById = incidentRecordById(model);
  const evidenceRows = legacy.evidenceMatrix.map((item) => {
    const record = evidenceById.get(item.id) || {};
    return {
      evidenceId: item.id,
      title: item.title,
      date: item.capturedAt || item.date,
      eventDate: item.date,
      capturedAt: item.capturedAt,
      dateStatus: record.dateStatus || "missing",
      status: item.status,
      verificationState: record.details?.verificationStatus || record.details?.proofStatus || "",
      evidenceRole: item.evidenceRole,
      evidenceType: record.details?.evidenceType || "",
      functionSummary: item.functionSummary,
      source: record.details?.source || "",
      sequenceGroup: record.sequenceGroup || "",
      linkedIncidentIds: item.linkedIncidents.map((incident) => incident.id),
      linkedIncidentTitles: item.linkedIncidents.map((incident) => incident.title),
      linkedIncidents: item.linkedIncidents,
      linkedRecords: item.linkedRecords,
      linkedRecordReferences: (record.links || []).map((link) => ({ targetId: link.targetId, targetType: link.targetType, targetTitle: link.targetTitle, status: link.status })),
      attachmentCount: item.attachmentCount,
      attachmentFilenames: item.attachmentNames,
      attachmentMetadata: record.attachmentMetadata || [],
      archived: record.archived === true,
      reviewNotes: item.reviewNotes,
    };
  });
  const supportedIncidents = legacy.supportedIncidents.map((incident) => {
    const record = incidentById.get(incident.id) || {};
    return {
      ...incident,
      date: record.canonicalDate || "",
      dateStatus: record.dateStatus || "missing",
      supportingEvidenceIds: incident.linkedEvidence.map((evidence) => evidence.id),
      supportingEvidenceCount: incident.linkedEvidence.length,
    };
  });
  const notices = [
    {
      code: "ARCHIVED_POLICY",
      severity: "info",
      message: definition?.includeArchived === false ? "Archived evidence is excluded." : "Archived evidence is included when present in the selected scope.",
    },
    {
      code: "ATTACHMENT_METADATA_ONLY",
      severity: "info",
      message: "Attachments are represented by metadata only; attachment content is not included.",
    },
  ];
  if ((model.unresolvedReferences || []).length > 0) notices.push({
    code: "UNRESOLVED_REFERENCES",
    severity: "warning",
    message: `${model.unresolvedReferences.length} unresolved reference(s) affect this report scope.`,
  });
  if (model.diagnostics?.records?.coverageNote) notices.push({
    code: "DIAGNOSTIC_COVERAGE",
    severity: "info",
    message: model.diagnostics.records.coverageNote,
  });

  return createReportDocument({
    definition,
    model,
    generatedAt: options.generatedAt,
    title: legacy.title,
    notices,
    summary: {
      caseOverview: legacy.caseOverview,
      scopeLabel: legacy.scopeLabel,
      includedEvidenceCount: legacy.includedEvidenceCount,
      includedEvidenceIds: legacy.includedEvidenceIds,
      scopedIncidentCount: model.records?.byType?.incident?.length || 0,
      archivedPolicy: definition?.includeArchived === false ? "excluded" : "included",
      atAGlance: legacy.atAGlance,
    },
    sections: [
      { id: "case-overview", heading: "Case Details", type: "summary", metadata: legacy.caseOverview },
      { id: "evidence-schedule", heading: "Evidence Schedule", type: "table", rows: evidenceRows },
      { id: "supported-incidents", heading: "Supported Incidents", type: "record-list", items: supportedIncidents },
      {
        id: "weak-unlinked-evidence",
        heading: "Weak or Unlinked Evidence",
        type: "diagnostics",
        diagnostics: {
          unlinkedEvidence: legacy.unlinkedWeakEvidence.unlinkedEvidence,
          evidenceMissingFunctionSummary: legacy.unlinkedWeakEvidence.evidenceMissingFunctionSummary,
          evidenceWithoutAttachments: legacy.unlinkedWeakEvidence.evidenceWithoutAttachments,
        },
      },
      { id: "diagnostics", heading: "Diagnostics", type: "diagnostics", diagnostics: legacy.diagnostics },
      { id: "unresolved-references", heading: "Unresolved References", type: "diagnostics", items: model.unresolvedReferences || [] },
      { id: "notices", heading: "Notices", type: "narrative", items: notices },
    ],
  });
}

export function projectEvidenceDocumentToLegacyViewModel(reportDocument) {
  const schedule = getReportDocumentSection(reportDocument, "evidence-schedule")?.rows || [];
  const incidents = getReportDocumentSection(reportDocument, "supported-incidents")?.items || [];
  const weak = getReportDocumentSection(reportDocument, "weak-unlinked-evidence")?.diagnostics || {};
  const diagnostics = getReportDocumentSection(reportDocument, "diagnostics")?.diagnostics || {};
  const summary = reportDocument?.summary || {};
  const scope = reportDocument?.source?.scope || {};
  return {
    reportType: "EVIDENCE_PACK_REPORT",
    title: reportDocument?.report?.title || "Evidence Pack: Whole Case",
    audience: "general",
    scopeType: scope.type === "sequenceGroup" ? "sequenceGroup" : "case",
    sequenceGroup: scope.type === "sequenceGroup" ? scope.sequenceGroupName || "" : "",
    scopeLabel: summary.scopeLabel || "Whole case",
    sourceCaseId: reportDocument?.source?.caseId || "",
    generatedAt: reportDocument?.report?.generatedAt || "",
    includedEvidenceCount: summary.includedEvidenceCount || 0,
    includedEvidenceIds: summary.includedEvidenceIds || [],
    caseOverview: summary.caseOverview || {},
    atAGlance: summary.atAGlance || {},
    evidenceMatrix: schedule.map((row) => ({
      id: row.evidenceId,
      title: row.title,
      date: row.eventDate || "",
      capturedAt: row.capturedAt || "",
      status: row.status,
      evidenceRole: row.evidenceRole,
      functionSummary: row.functionSummary,
      linkedIncidents: row.linkedIncidents || [],
      linkedRecords: row.linkedRecords || [],
      attachmentNames: row.attachmentFilenames || [],
      attachmentCount: row.attachmentCount || 0,
      reviewNotes: row.reviewNotes || "",
    })),
    supportedIncidents: incidents.map((incident) => ({
      id: incident.id,
      title: incident.title,
      evidenceStatus: incident.evidenceStatus,
      linkedEvidence: incident.linkedEvidence,
      remainsUnsupported: incident.remainsUnsupported,
    })),
    unlinkedWeakEvidence: {
      unlinkedEvidence: weak.unlinkedEvidence || [],
      evidenceMissingFunctionSummary: weak.evidenceMissingFunctionSummary || [],
      evidenceWithoutAttachments: weak.evidenceWithoutAttachments || [],
    },
    diagnostics,
  };
}
