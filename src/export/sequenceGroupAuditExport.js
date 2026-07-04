import { getIncidentLinkGroups, sortTimelineItems } from "../domain/caseDomain.js";
import { resolveRecordById } from "../domain/linkingResolvers.js";
import { sanitizeAttachmentForExport } from "./caseExport.js";

export const SEQUENCE_GROUP_AUDIT_PROMPT =
  "Please audit this sequence group for chronology accuracy, evidence strength, missing records, weak links, unsupported claims, escalation readiness, and safe ProveIt updates.";

function text(value) {
  return typeof value === "string" ? value : "";
}

function cleanSequenceGroup(value) {
  return text(value).trim();
}

function list(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string" && item.trim()) : [];
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function getDate(record = {}) {
  return record.eventDate || record.date || record.documentDate || record.capturedAt || record.createdAt || "";
}

function isVagueFunctionSummary(value) {
  const summary = text(value).trim().toLowerCase();
  if (!summary) return true;
  if (summary.length < 20) return true;
  return ["important", "useful", "evidence", "proof", "supporting", "document"].includes(summary);
}

function normalizeAttachment(att) {
  const safe = sanitizeAttachmentForExport(att || {});
  const filename = safe?.filename || safe?.fileName || safe?.name || "";
  const type = safe?.type || safe?.mimeType || safe?.kind || "";
  return {
    filename,
    type,
    createdAt: safe?.createdAt || "",
    metadataAvailable: Boolean(filename || type || safe?.size || safe?.emailMeta || safe?.storage),
  };
}

function collectEvidenceAttachments(evidence = {}) {
  const attachments = Array.isArray(evidence.attachments) ? evidence.attachments : [];
  const digitalFiles = Array.isArray(evidence.availability?.digital?.files) ? evidence.availability.digital.files : [];
  return [...attachments, ...digitalFiles].map(normalizeAttachment);
}

function buildIncidentLinks(caseData, incident) {
  const groups = getIncidentLinkGroups(caseData, incident.id);
  const mapIncident = ({ incident: linkedIncident }) => ({
    id: linkedIncident.id,
    title: linkedIncident.title || "",
    date: getDate(linkedIncident),
    sequenceGroup: cleanSequenceGroup(linkedIncident.sequenceGroup),
  });

  return {
    causes: groups.causes.map(mapIncident),
    outcomes: groups.outcomes.map(mapIncident),
    related: groups.related.map(mapIncident),
  };
}

function mapIncident(caseData, incident, { externalLinkedRecord = false } = {}) {
  return {
    id: incident.id || "",
    title: incident.title || "",
    date: incident.date || "",
    eventDate: incident.eventDate || "",
    status: incident.status || "",
    evidenceStatus: incident.evidenceStatus || "",
    sequenceGroup: cleanSequenceGroup(incident.sequenceGroup),
    isMilestone: Boolean(incident.isMilestone),
    description: text(incident.description),
    notes: text(incident.notes),
    tags: Array.isArray(incident.tags) ? incident.tags : [],
    linkedEvidenceIds: list(incident.linkedEvidenceIds),
    linkedRecordIds: list(incident.linkedRecordIds),
    incidentLinks: buildIncidentLinks(caseData, incident),
    ...(externalLinkedRecord ? { externalLinkedRecord: true } : {}),
  };
}

function mapEvidence(evidence) {
  return {
    id: evidence.id || "",
    title: evidence.title || "",
    date: evidence.date || evidence.capturedAt || "",
    status: evidence.status || "",
    importance: evidence.importance || "",
    relevance: evidence.relevance || "",
    evidenceRole: evidence.evidenceRole || "",
    functionSummary: text(evidence.functionSummary),
    notes: text(evidence.notes || evidence.reviewNotes),
    attachments: collectEvidenceAttachments(evidence),
    linkedIncidentIds: list(evidence.linkedIncidentIds),
    linkedRecordIds: list(evidence.linkedRecordIds),
    sequenceGroup: cleanSequenceGroup(evidence.sequenceGroup),
  };
}

function mapDocument(doc) {
  const attachments = Array.isArray(doc.attachments) ? doc.attachments.map(normalizeAttachment) : [];
  return {
    id: doc.id || "",
    title: doc.title || "",
    documentDate: doc.documentDate || "",
    category: doc.category || "",
    source: doc.source || "",
    summary: text(doc.summary),
    sequenceGroup: cleanSequenceGroup(doc.sequenceGroup),
    attachmentCount: attachments.length,
    attachments,
    linkedRecordIds: list(doc.linkedRecordIds),
    basedOnEvidenceIds: list(doc.basedOnEvidenceIds),
    hasTextContent: Boolean(text(doc.textContent).trim()),
  };
}

function resolveIncidentIdsFromRecord(caseData, record = {}) {
  const ids = [
    ...list(record.linkedIncidentIds),
    ...list(record.linkedRecordIds).filter((id) => resolveRecordById(caseData, id)?.recordType === "incident"),
  ];
  if (Array.isArray(record.linkedIncidentRefs)) {
    ids.push(...record.linkedIncidentRefs.map((ref) => ref?.incidentId).filter(Boolean));
  }
  return unique(ids);
}

function collectLinkedDocumentIds(caseData, incidentIds, evidenceIds) {
  const targetIds = new Set([...incidentIds, ...evidenceIds]);
  const documentIds = new Set();

  for (const id of [...targetIds]) {
    const resolved = resolveRecordById(caseData, id);
    for (const linkedId of list(resolved?.record?.linkedRecordIds)) {
      const linked = resolveRecordById(caseData, linkedId);
      if (linked?.recordType === "document") documentIds.add(linkedId);
    }
  }

  for (const doc of caseData.documents || []) {
    const linkedRecordIds = list(doc.linkedRecordIds);
    const basedOnEvidenceIds = list(doc.basedOnEvidenceIds);
    if (
      linkedRecordIds.some((id) => targetIds.has(id)) ||
      basedOnEvidenceIds.some((id) => evidenceIds.includes(id))
    ) {
      documentIds.add(doc.id);
    }
  }

  return [...documentIds];
}

function hasAnyLink(record = {}) {
  return [
    ...list(record.linkedEvidenceIds),
    ...list(record.linkedIncidentIds),
    ...list(record.linkedRecordIds),
    ...list(record.basedOnEvidenceIds),
    ...(Array.isArray(record.linkedIncidentRefs) ? record.linkedIncidentRefs.map((ref) => ref?.incidentId).filter(Boolean) : []),
  ].length > 0;
}

function diagnostic(record, recordType, code, message) {
  return {
    id: record.id || "",
    recordType,
    title: record.title || record.label || "",
    code,
    message,
  };
}

function collectDiagnostics(caseData, groupName, groupIncidents, includedEvidence, groupRecords, externalLinkedRecords) {
  const unsupportedIncidents = groupIncidents
    .filter((incident) => incident.evidenceStatus === "needs_evidence")
    .map((incident) => diagnostic(incident, "incident", "incident_needs_evidence", "Incident evidenceStatus is needs_evidence."));

  const unusedEvidence = includedEvidence
    .filter((evidence) => list(evidence.linkedIncidentIds).length === 0)
    .map((evidence) => diagnostic(evidence, "evidence", "evidence_without_linked_incident", "Evidence has no linked incidents."));

  const weakRecords = [];
  const dateInconsistencies = [];
  const evidenceLinkedToUnrelatedSequenceGroups = [];

  for (const incident of groupIncidents) {
    if (!hasAnyLink(incident)) {
      weakRecords.push(diagnostic(incident, "incident", "group_record_zero_links", "Record in the group has zero links."));
    }
    if (incident.isMilestone && list(incident.linkedEvidenceIds).length === 0) {
      weakRecords.push(diagnostic(incident, "incident", "milestone_without_evidence", "Milestone incident has no linked evidence."));
    }
    if (!text(incident.description).trim()) {
      weakRecords.push(diagnostic(incident, "incident", "missing_description", "Incident is missing a description."));
    }
    if (!text(incident.notes).trim()) {
      weakRecords.push(diagnostic(incident, "incident", "missing_notes", "Incident is missing notes."));
    }
    if (incident.date && incident.eventDate && incident.date !== incident.eventDate) {
      dateInconsistencies.push(diagnostic(incident, "incident", "date_event_date_mismatch", "Incident date and eventDate differ."));
    }
  }

  for (const evidence of includedEvidence) {
    if (!hasAnyLink(evidence)) {
      weakRecords.push(diagnostic(evidence, "evidence", "group_record_zero_links", "Evidence has zero links."));
    }
    if (isVagueFunctionSummary(evidence.functionSummary)) {
      weakRecords.push(diagnostic(evidence, "evidence", "vague_function_summary", "Evidence has a missing or vague functionSummary."));
    }
    if (!text(evidence.notes || evidence.reviewNotes).trim()) {
      weakRecords.push(diagnostic(evidence, "evidence", "missing_notes", "Evidence is missing notes."));
    }

    for (const incidentId of resolveIncidentIdsFromRecord(caseData, evidence)) {
      const linkedIncident = (caseData.incidents || []).find((incident) => incident.id === incidentId);
      const linkedGroup = cleanSequenceGroup(linkedIncident?.sequenceGroup);
      if (linkedIncident && linkedGroup && linkedGroup !== groupName) {
        evidenceLinkedToUnrelatedSequenceGroups.push({
          ...diagnostic(evidence, "evidence", "evidence_linked_to_unrelated_sequence_group", "Evidence is linked to an incident in another sequence group."),
          linkedIncidentId: linkedIncident.id,
          linkedSequenceGroup: linkedGroup,
        });
      }
    }
  }

  for (const record of groupRecords) {
    if (!hasAnyLink(record)) {
      weakRecords.push(diagnostic(record, record.recordType || "record", "group_record_zero_links", "Record in the group has zero links."));
    }
  }

  return {
    unsupportedIncidents,
    unusedEvidence,
    weakRecords,
    dateInconsistencies,
    evidenceLinkedToUnrelatedSequenceGroups,
    externalLinkedRecords: externalLinkedRecords.map((record) => ({
      id: record.id,
      recordType: "incident",
      title: record.title,
      sequenceGroup: record.sequenceGroup,
      externalLinkedRecord: true,
    })),
  };
}

function buildLinkMap(caseData, incidents, evidence, documents, externalLinkedRecords) {
  const edgeRows = [];
  const add = (sourceId, sourceType, field, targetId, relationship) => {
    const resolved = resolveRecordById(caseData, targetId);
    edgeRows.push({
      sourceId,
      sourceType,
      field,
      targetId,
      targetType: resolved?.recordType || "unknown",
      targetTitle: resolved?.title || "",
      relationship,
      externalTarget: externalLinkedRecords.some((record) => record.id === targetId),
      resolved: Boolean(resolved),
    });
  };

  incidents.forEach((incident) => {
    list(incident.linkedEvidenceIds).forEach((id) => add(incident.id, "incident", "linkedEvidenceIds", id, "has_evidence"));
    list(incident.linkedRecordIds).forEach((id) => add(incident.id, "incident", "linkedRecordIds", id, "linked_record"));
    for (const group of ["causes", "outcomes", "related"]) {
      (incident.incidentLinks?.[group] || []).forEach((linked) => add(incident.id, "incident", `incidentLinks.${group}`, linked.id, group));
    }
  });

  evidence.forEach((item) => {
    list(item.linkedIncidentIds).forEach((id) => add(item.id, "evidence", "linkedIncidentIds", id, "supports_incident"));
    list(item.linkedRecordIds).forEach((id) => add(item.id, "evidence", "linkedRecordIds", id, "linked_record"));
  });

  documents.forEach((doc) => {
    list(doc.linkedRecordIds).forEach((id) => add(doc.id, "document", "linkedRecordIds", id, "linked_record"));
    list(doc.basedOnEvidenceIds).forEach((id) => add(doc.id, "document", "basedOnEvidenceIds", id, "provenance"));
  });

  return edgeRows;
}

export function buildSequenceGroupAuditReport(caseData, sequenceGroup, options = {}) {
  if (!caseData) throw new Error("caseData is required for SEQUENCE_GROUP_FULL_RECORD_AUDIT_REPORT");
  const groupName = cleanSequenceGroup(sequenceGroup);
  if (!groupName) throw new Error("sequenceGroup is required for SEQUENCE_GROUP_FULL_RECORD_AUDIT_REPORT");
  const groupDescription = text(options.sequenceGroupMeta?.[groupName]?.description);

  const incidents = Array.isArray(caseData.incidents) ? caseData.incidents : [];
  const evidenceRecords = Array.isArray(caseData.evidence) ? caseData.evidence : [];
  const documents = Array.isArray(caseData.documents) ? caseData.documents : [];
  const groupIncidents = incidents.filter((incident) => cleanSequenceGroup(incident.sequenceGroup) === groupName);
  const groupIncidentIds = groupIncidents.map((incident) => incident.id);

  const linkedEvidenceIds = unique([
    ...groupIncidents.flatMap((incident) => list(incident.linkedEvidenceIds)),
    ...evidenceRecords
      .filter((evidence) => list(evidence.linkedIncidentIds).some((id) => groupIncidentIds.includes(id)))
      .map((evidence) => evidence.id),
  ]);
  const includedEvidence = evidenceRecords.filter((evidence) =>
    cleanSequenceGroup(evidence.sequenceGroup) === groupName || linkedEvidenceIds.includes(evidence.id)
  );
  const includedEvidenceIds = includedEvidence.map((evidence) => evidence.id);

  const externalIncidentIds = unique([
    ...groupIncidents.flatMap((incident) => resolveIncidentIdsFromRecord(caseData, incident)),
    ...includedEvidence.flatMap((evidence) => resolveIncidentIdsFromRecord(caseData, evidence)),
  ]).filter((id) => !groupIncidentIds.includes(id));
  const externalLinkedRecords = incidents
    .filter((incident) => externalIncidentIds.includes(incident.id))
    .map((incident) => mapIncident(caseData, incident, { externalLinkedRecord: true }));

  const documentIds = collectLinkedDocumentIds(caseData, groupIncidentIds, includedEvidenceIds);
  const includedDocuments = documents.filter((doc) => documentIds.includes(doc.id));
  const groupOtherRecords = [
    ...(Array.isArray(caseData.strategy) ? caseData.strategy : [])
      .filter((record) => cleanSequenceGroup(record.sequenceGroup) === groupName)
      .map((record) => ({ ...record, recordType: "strategy" })),
    ...includedDocuments.map((record) => ({ ...record, recordType: "document" })),
  ];

  const mappedIncidents = sortTimelineItems(groupIncidents).map((incident) => mapIncident(caseData, incident));
  const mappedEvidence = includedEvidence
    .map(mapEvidence)
    .sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")) || String(a.id).localeCompare(String(b.id)));
  const mappedDocuments = includedDocuments
    .map(mapDocument)
    .sort((a, b) => String(a.documentDate || "").localeCompare(String(b.documentDate || "")) || String(a.id).localeCompare(String(b.id)));
  const chronology = [
    ...mappedIncidents.map((record) => ({ id: record.id, recordType: "incident", date: record.eventDate || record.date, title: record.title, status: record.status })),
    ...mappedEvidence.map((record) => ({ id: record.id, recordType: "evidence", date: record.date, title: record.title, status: record.status })),
    ...mappedDocuments.map((record) => ({ id: record.id, recordType: "document", date: record.documentDate, title: record.title, status: "" })),
  ].sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")) || String(a.recordType).localeCompare(String(b.recordType)) || String(a.id).localeCompare(String(b.id)));

  const diagnostics = collectDiagnostics(caseData, groupName, groupIncidents, includedEvidence, groupOtherRecords, externalLinkedRecords);
  const linkMap = buildLinkMap(caseData, mappedIncidents, mappedEvidence, mappedDocuments, externalLinkedRecords);

  return {
    exportType: "SEQUENCE_GROUP_FULL_RECORD_AUDIT_REPORT",
    schemaVersion: "sequence-group-audit-1.0",
    exportedAt: new Date().toISOString(),
    importable: false,
    includesBinaryData: false,
    case: {
      id: caseData.id || "",
      name: caseData.name || "",
      category: caseData.category || "",
      status: caseData.status || "",
    },
    sequenceGroup: groupName,
    threadOverview: {
      description: groupDescription,
      incidentCount: mappedIncidents.length,
      evidenceCount: mappedEvidence.length,
      documentCount: mappedDocuments.length,
      externalLinkedRecordCount: externalLinkedRecords.length,
      chronologyItemCount: chronology.length,
      diagnosticCount: Object.values(diagnostics).reduce((sum, items) => sum + (Array.isArray(items) ? items.length : 0), 0),
    },
    chronology,
    incidents: mappedIncidents,
    evidence: mappedEvidence,
    documents: mappedDocuments,
    linkMap,
    diagnostics,
    unsupportedIncidents: diagnostics.unsupportedIncidents,
    unusedEvidence: diagnostics.unusedEvidence,
    weakRecords: diagnostics.weakRecords,
    externalLinkedRecords,
    gptAuditPromptBlock: SEQUENCE_GROUP_AUDIT_PROMPT,
  };
}

function mdEscape(value) {
  return text(value).replace(/\|/g, "\\|").replace(/\n/g, " ").trim();
}

function mdList(items, formatter) {
  if (!items || items.length === 0) return "- None";
  return items.map(formatter).join("\n");
}

export function exportSequenceGroupAuditJson(caseData, sequenceGroup, options = {}) {
  return buildSequenceGroupAuditReport(caseData, sequenceGroup, options);
}

export function exportSequenceGroupAuditMarkdown(caseData, sequenceGroup, options = {}) {
  const report = buildSequenceGroupAuditReport(caseData, sequenceGroup, options);
  const lines = [
    "# Sequence Group Full Record Audit Report",
    "",
    `Case: ${report.case.name || report.case.id}`,
    `Case ID: ${report.case.id}`,
    `Sequence Group: ${report.sequenceGroup}`,
    `Exported: ${report.exportedAt}`,
    "",
    "## Thread overview",
    "",
    `- Description: ${mdEscape(report.threadOverview.description) || "-"}`,
    `- Incidents: ${report.threadOverview.incidentCount}`,
    `- Evidence: ${report.threadOverview.evidenceCount}`,
    `- Documents: ${report.threadOverview.documentCount}`,
    `- External linked records: ${report.threadOverview.externalLinkedRecordCount}`,
    `- Diagnostics: ${report.threadOverview.diagnosticCount}`,
    "",
    "## Chronology table",
    "",
    "| Date | Type | ID | Title | Status |",
    "| --- | --- | --- | --- | --- |",
    ...report.chronology.map((item) => `| ${mdEscape(item.date)} | ${mdEscape(item.recordType)} | ${mdEscape(item.id)} | ${mdEscape(item.title)} | ${mdEscape(item.status)} |`),
    "",
    "## Full incident records",
    "",
    mdList(report.incidents, (item) => `- ${item.id} | ${item.eventDate || item.date || "No date"} | ${item.title}\n  - status: ${item.status || "none"}; evidenceStatus: ${item.evidenceStatus || "none"}\n  - description: ${item.description || "None"}\n  - notes: ${item.notes || "None"}\n  - linkedEvidenceIds: ${item.linkedEvidenceIds.join(", ") || "None"}\n  - linkedRecordIds: ${item.linkedRecordIds.join(", ") || "None"}`),
    "",
    "## Full evidence records",
    "",
    mdList(report.evidence, (item) => `- ${item.id} | ${item.date || "No date"} | ${item.title}\n  - status: ${item.status || "none"}; importance: ${item.importance || "none"}; relevance: ${item.relevance || "none"}\n  - role: ${item.evidenceRole || "none"}\n  - functionSummary: ${item.functionSummary || "None"}\n  - notes: ${item.notes || "None"}\n  - attachments: ${item.attachments.map((att) => att.filename || att.type || "metadata").join(", ") || "None"}\n  - linkedIncidentIds: ${item.linkedIncidentIds.join(", ") || "None"}\n  - linkedRecordIds: ${item.linkedRecordIds.join(", ") || "None"}`),
    "",
    "## Link map",
    "",
    mdList(report.linkMap, (edge) => `- ${edge.sourceType}:${edge.sourceId} -> ${edge.targetType}:${edge.targetId} (${edge.relationship}, ${edge.resolved ? "resolved" : "missing"})`),
    "",
    "## Unsupported incidents",
    "",
    mdList(report.unsupportedIncidents, (item) => `- ${item.id} | ${item.title}: ${item.message}`),
    "",
    "## Unused evidence",
    "",
    mdList(report.unusedEvidence, (item) => `- ${item.id} | ${item.title}: ${item.message}`),
    "",
    "## Weak records",
    "",
    mdList(report.weakRecords, (item) => `- ${item.recordType}:${item.id} | ${item.title}: ${item.message}`),
    "",
    "## External linked records",
    "",
    mdList(report.externalLinkedRecords, (item) => `- ${item.id} | ${item.title} | sequenceGroup: ${item.sequenceGroup || "none"} | externalLinkedRecord: true`),
    "",
    "## GPT audit prompt block",
    "",
    report.gptAuditPromptBlock,
    "",
  ];

  return lines.join("\n");
}

export function printSequenceGroupAuditPdf(caseData, sequenceGroup, options = {}) {
  const markdown = exportSequenceGroupAuditMarkdown(caseData, sequenceGroup, options);
  const printWindow = window.open("", "_blank", "noopener,noreferrer");
  if (!printWindow) return false;
  printWindow.document.write(`<pre style="white-space: pre-wrap; font-family: Arial, sans-serif; line-height: 1.45;">${markdown.replace(/[&<>]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[char])}</pre>`);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
  return true;
}
