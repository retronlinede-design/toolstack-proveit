import { buildDocumentPackReportFromModel } from "./documentPackModelAdapter.js";
import { createReportDocument, getReportDocumentSection } from "./reportDocument.js";

export function buildDocumentScheduleDocument(reportModel, definition, options = {}) {
  const model = reportModel && typeof reportModel === "object" ? reportModel : {};
  const legacy = buildDocumentPackReportFromModel(model, options);
  const byId = new Map((model.records?.all || []).map((record) => [record.id, record]));
  const rows = legacy.documentMatrix.map((item) => {
    const record = byId.get(item.id) || {};
    return { documentId: item.id, ...item, dateStatus: record.dateStatus || "missing", documentType: record.details?.documentType || item.category, source: record.details?.source || "", author: record.details?.author || "", status: record.status || "", archived: record.archived === true, linkedRecordReferences: record.links || [] };
  });
  const unresolved = (model.unresolvedReferences || []).filter((item) => legacy.includedDocumentIds.includes(item.sourceRecordId));
  const notices = [
    { code: "ARCHIVED_POLICY", severity: "info", message: definition?.includeArchived === false ? "Archived documents are excluded." : "Archived documents are included when present in the selected scope." },
    { code: "ATTACHMENT_METADATA_ONLY", severity: "info", message: "Attachments are represented by metadata only; attachment content is not included." },
  ];
  if (unresolved.length) notices.push({ code: "UNRESOLVED_REFERENCES", severity: "warning", message: `${unresolved.length} unresolved reference(s) affect this document schedule.` });
  return createReportDocument({ definition, model, generatedAt: options.generatedAt, title: legacy.title, notices,
    summary: { caseOverview: legacy.caseOverview, scopeLabel: legacy.scopeLabel, includedDocumentCount: legacy.includedDocumentCount, includedDocumentIds: legacy.includedDocumentIds, archivedDocumentCount: rows.filter((row) => row.archived).length, ungroupedDocumentCount: rows.filter((row) => !row.sequenceGroup).length, unresolvedReferenceCount: unresolved.length, archivedPolicy: definition?.includeArchived === false ? "excluded" : "included", atAGlance: legacy.atAGlance },
    sections: [
      { id: "case-overview", heading: "Case Details", type: "summary", metadata: legacy.caseOverview },
      { id: "document-schedule", heading: "Document Schedule", type: "table", rows },
      { id: "linked-incident-context", heading: "Linked Incident Context", type: "record-list", items: legacy.supportSummary.linkedIncidents, metadata: { linkedEvidence: legacy.supportSummary.linkedEvidence } },
      { id: "weak-incomplete-documents", heading: "Weak or Incomplete Documents", type: "diagnostics", diagnostics: legacy.unlinkedWeakDocuments },
      { id: "diagnostics", heading: "Diagnostics", type: "diagnostics", diagnostics: legacy.diagnostics },
      { id: "unresolved-references", heading: "Unresolved References", type: "diagnostics", items: unresolved },
      { id: "notices", heading: "Notices", type: "narrative", items: notices },
    ] });
}

export function projectDocumentDocumentToLegacyViewModel(document) {
  const summary = document?.summary || {};
  const scope = document?.source?.scope || {};
  return { reportType: "DOCUMENT_PACK_REPORT", title: document?.report?.title || "Document Pack: Whole Case", audience: "general", scopeType: scope.type === "sequenceGroup" ? "sequenceGroup" : "case", sequenceGroup: scope.type === "sequenceGroup" ? scope.sequenceGroupName || "" : "", scopeLabel: summary.scopeLabel || "Whole case", sourceCaseId: document?.source?.caseId || "", generatedAt: document?.report?.generatedAt || "", includedDocumentCount: summary.includedDocumentCount || 0, includedDocumentIds: summary.includedDocumentIds || [], caseOverview: summary.caseOverview || {}, atAGlance: summary.atAGlance || {}, documentMatrix: getReportDocumentSection(document, "document-schedule")?.rows || [], supportSummary: { linkedIncidents: getReportDocumentSection(document, "linked-incident-context")?.items || [], linkedEvidence: getReportDocumentSection(document, "linked-incident-context")?.metadata?.linkedEvidence || [] }, unlinkedWeakDocuments: getReportDocumentSection(document, "weak-incomplete-documents")?.diagnostics || {}, diagnostics: getReportDocumentSection(document, "diagnostics")?.diagnostics || {} };
}
