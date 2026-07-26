import { DOCUMENT_PACK_REPORT } from "./reportBuilder.js";
import { getLegacyLinkedRecords, getModelPackRecords, getModelRecordById } from "./reportModelPackUtils.js";

function shortText(value, limit = 600) {
  const text = typeof value === "string" ? value.trim() : "";
  return text.length > limit ? `${text.slice(0, limit).trim()}...` : text;
}

function buildDocument(record, recordById) {
  const linkedRecords = getLegacyLinkedRecords(record, recordById, ["linkedRecordIds", "basedOnEvidenceIds"]);
  const attachmentMetadata = (record.attachmentMetadata || []).map((attachment) => ({
    id: attachment.id || "", name: attachment.filename || "", type: attachment.mimeType || "", size: attachment.sizeBytes ?? null,
  }));
  return {
    id: record.id, title: record.title, documentDate: record.details.documentDate || record.eventDate || "",
    date: record.details.date || "", createdAt: record.details.createdAt || record.loggedDate || "", updatedAt: record.details.updatedAt || "",
    category: record.details.category || "", sequenceGroup: record.sequenceGroup || "", summary: record.details.summary || "", notes: record.notes || "",
    functionSummary: record.details.functionSummary || "", textExcerpt: shortText(record.details.textContent), linkedRecords,
    linkedIncidents: linkedRecords.filter((item) => item.recordType === "incident"),
    linkedEvidence: linkedRecords.filter((item) => item.recordType === "evidence"),
    linkedStrategy: linkedRecords.filter((item) => item.recordType === "strategy"),
    attachmentMetadata, attachmentNames: attachmentMetadata.map((item) => item.name).filter(Boolean), attachmentCount: attachmentMetadata.length,
  };
}

function supportSummary(documents) {
  const collect = (field) => {
    const map = new Map();
    documents.forEach((document) => document[field].forEach((record) => {
      if (!map.has(record.id)) map.set(record.id, { ...record, documents: [] });
      map.get(record.id).documents.push({ id: document.id, title: document.title });
    }));
    return [...map.values()];
  };
  return { linkedIncidents: collect("linkedIncidents"), linkedEvidence: collect("linkedEvidence") };
}

export function buildDocumentPackReportFromModel(model, options = {}) {
  const records = getModelPackRecords(model, "document");
  const recordById = getModelRecordById(model);
  const documentMatrix = records.map((record) => buildDocument(record, recordById));
  const support = supportSummary(documentMatrix);
  const diagnostics = model?.diagnostics?.case || {};
  const ids = new Set(records.map((record) => record.id));
  const scopeType = model?.scope?.type === "sequenceGroup" ? "sequenceGroup" : "case";
  const sequenceGroup = scopeType === "sequenceGroup" ? model?.scope?.sequenceGroupName || "" : "";
  const unlinkedDocuments = documentMatrix.filter((item) => item.linkedRecords.length === 0);
  const documentsMissingSummary = documentMatrix.filter((item) => ![item.summary, item.notes, item.functionSummary].some((value) => String(value || "").trim()));
  const packDiagnostics = {
    weaklyLinkedDocuments: (diagnostics.integrity?.weaklyLinkedRecords || []).filter((item) => ["document", "tracking_record"].includes(item.type) && ids.has(item.id)),
    orphanDocuments: (diagnostics.integrity?.orphanRecords || []).filter((item) => ["document", "tracking_record"].includes(item.type) && ids.has(item.id)),
    brokenLinks: (diagnostics.integrity?.brokenLinks || []).filter((item) => ids.has(item.sourceId) || ids.has(item.targetId)),
    warnings: diagnostics.warnings || [], suggestions: diagnostics.suggestions || [],
  };
  return {
    reportType: DOCUMENT_PACK_REPORT,
    title: scopeType === "sequenceGroup" ? `Document Pack: ${sequenceGroup || "Unselected sequenceGroup"}` : "Document Pack: Whole Case",
    audience: "general", scopeType, sequenceGroup, scopeLabel: scopeType === "sequenceGroup" ? `sequenceGroup: ${sequenceGroup || "-"}` : "Whole case",
    sourceCaseId: model?.sourceCase?.id || "", generatedAt: options.generatedAt || model?.generatedAt || new Date().toISOString(),
    includedDocumentCount: records.length, includedDocumentIds: records.map((record) => record.id),
    caseOverview: { name: model?.sourceCase?.name || "", category: model?.sourceCase?.category || "", status: model?.sourceCase?.status || "" },
    atAGlance: {
      documentCount: records.length, linkedDocumentCount: documentMatrix.length - unlinkedDocuments.length, unlinkedDocumentCount: unlinkedDocuments.length,
      linkedIncidentCount: support.linkedIncidents.length, linkedEvidenceCount: support.linkedEvidence.length,
      documentWithAttachmentsCount: documentMatrix.filter((item) => item.attachmentCount > 0).length,
      documentWithTextCount: documentMatrix.filter((item) => item.textExcerpt.trim()).length,
      documentMissingSummaryCount: documentsMissingSummary.length,
    },
    documentMatrix, supportSummary: support,
    unlinkedWeakDocuments: { unlinkedDocuments, documentsMissingSummary, documentsWithoutAttachments: documentMatrix.filter((item) => item.attachmentCount === 0), documentsWithoutText: documentMatrix.filter((item) => !item.textExcerpt.trim()) },
    diagnostics: packDiagnostics,
  };
}
