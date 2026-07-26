import { createReportDocument } from "./reportDocument.js";

const LINK_TYPES = Object.freeze(["evidence", "document", "strategy", "watch", "ledger"]);

function key(record) { return `${record?.type || "record"}:${record?.id || ""}`; }
function unique(records) { return [...new Map(records.filter(Boolean).map((record) => [key(record), record])).values()]; }
function resolvedLinksForIncident(incident, allRecords) {
  const byId = new Map(allRecords.filter((record) => record.id).map((record) => [record.id, record]));
  const outgoing = (incident.links || []).filter((link) => link.status === "resolved").map((link) => byId.get(link.targetId));
  const incoming = allRecords.filter((record) => record.id !== incident.id && (record.links || []).some((link) => link.status === "resolved" && link.targetId === incident.id));
  return unique([...outgoing, ...incoming]);
}
function relevantUnresolved(model, incident) {
  return (model.unresolvedReferences || []).filter((item) => item.sourceRecordType === "incident" && item.sourceRecordId === incident.id);
}
function refs(records, type) {
  return records.filter((record) => record.type === type).map((record) => ({ id: record.id, title: record.title }));
}
function finding(code, severity, incident, message) { return { code, severity, recordId: incident.id, recordType: "incident", message }; }

export function buildIncidentScheduleDocument(reportModel, definition, options = {}) {
  const model = reportModel && typeof reportModel === "object" ? reportModel : {};
  const incidents = model.records?.byType?.incident || [];
  const allRecords = model.records?.all || [];
  const rows = incidents.map((incident) => {
    const linked = resolvedLinksForIncident(incident, allRecords);
    const evidence = refs(linked, "evidence");
    const documents = refs(linked, "document");
    const strategies = refs(linked, "strategy");
    const watch = refs(linked, "watch");
    const ledger = refs(linked, "ledger");
    const unresolved = relevantUnresolved(model, incident);
    return {
      incidentId: incident.id, title: incident.title, eventDate: incident.eventDate, loggedDate: incident.loggedDate,
      canonicalDate: incident.canonicalDate, dateStatus: incident.dateStatus, status: incident.status,
      category: incident.details?.category || incident.details?.incidentType || incident.details?.type || "",
      description: incident.details?.description || incident.summary, functionSummary: incident.details?.functionSummary || "",
      outcome: incident.details?.outcome || "", sequenceGroup: incident.sequenceGroup, archived: incident.archived,
      relatedPartyIds: incident.partyIds || [],
      resolvedParties: (incident.resolvedParties || []).filter((party) => !party.unresolved).map(({ id, name, role }) => ({ id, name, role })),
      linkedEvidence: evidence, linkedDocuments: documents, linkedStrategies: strategies, linkedWatch: watch, linkedLedger: ledger,
      attachmentCount: (incident.attachmentMetadata || []).length,
      attachmentFilenames: (incident.attachmentMetadata || []).map((item) => item.filename).filter(Boolean),
      unresolvedReferenceCount: unresolved.length,
    };
  });
  const coverage = rows.map((row) => {
    const hasEvidence = row.linkedEvidence.length > 0;
    const hasUnresolved = row.unresolvedReferenceCount > 0;
    const coverageStatus = hasEvidence ? (hasUnresolved ? "partially-supported" : "supported") : (hasUnresolved ? "unresolved-links" : "unlinked");
    return { incidentId: row.incidentId, incidentTitle: row.title, supportingEvidenceIds: row.linkedEvidence.map((item) => item.id), supportingEvidenceTitles: row.linkedEvidence.map((item) => item.title), supportingEvidenceCount: row.linkedEvidence.length, linkedDocumentIds: row.linkedDocuments.map((item) => item.id), linkedDocumentCount: row.linkedDocuments.length, unresolvedReferenceCount: row.unresolvedReferenceCount, coverageStatus };
  });
  const findings = [];
  incidents.forEach((incident) => {
    if (incident.dateStatus === "missing") findings.push(finding("INCIDENT_MISSING_DATE", "warning", incident, "Incident has no event or canonical date."));
    if (incident.dateStatus === "malformed") findings.push(finding("INCIDENT_MALFORMED_DATE", "warning", incident, "Incident has a malformed event or canonical date."));
    if (!incident.id || incident.title === incident.id || /^Untitled incident$/i.test(incident.title)) findings.push(finding("INCIDENT_MISSING_TITLE", "warning", incident, "Incident has no title."));
    if (!incident.summary && !incident.details?.functionSummary) findings.push(finding("INCIDENT_MISSING_DESCRIPTION", "warning", incident, "Incident has no description or function summary."));
    if (!coverage.find((item) => item.incidentId === incident.id)?.supportingEvidenceCount) findings.push(finding("INCIDENT_NO_LINKED_EVIDENCE", "info", incident, "Incident has no structured evidence association."));
    if (!incident.sequenceGroup) findings.push(finding("INCIDENT_NO_SEQUENCE_GROUP", "info", incident, "Incident is not assigned to a Sequence Group."));
    if (relevantUnresolved(model, incident).some((item) => item.referenceType === "party")) findings.push(finding("INCIDENT_UNRESOLVED_PARTY", "warning", incident, "Incident contains an unresolved party reference."));
    if (relevantUnresolved(model, incident).some((item) => item.referenceType !== "party")) findings.push(finding("INCIDENT_UNRESOLVED_RECORD", "warning", incident, "Incident contains an unresolved record reference."));
    if (Object.hasOwn(incident.details || {}, "outcome") && !String(incident.details.outcome || "").trim()) findings.push(finding("INCIDENT_MISSING_OUTCOME", "info", incident, "Incident outcome is blank."));
    if (incident.archived) findings.push(finding("INCIDENT_ARCHIVED", "info", incident, "Archived incident is included by report policy."));
  });
  const unresolved = (model.unresolvedReferences || []).filter((item) => item.sourceRecordType === "incident" && incidents.some((record) => record.id === item.sourceRecordId));
  const notices = [
    { code: "COVERAGE_POLICY", severity: "info", message: "Coverage status describes structured evidence associations. It does not determine whether an incident is proven." },
    { code: "ARCHIVED_POLICY", severity: "info", message: definition?.includeArchived === false ? "Archived incidents are excluded." : "Archived incidents are included when present in the selected scope." },
    { code: "ATTACHMENT_METADATA_ONLY", severity: "info", message: "Attachments are represented by metadata only; attachment content is not included." },
  ];
  const summary = {
    caseOverview: model.sourceCase || {}, scopeLabel: model.scope?.type === "sequenceGroup" ? `Sequence Group: ${model.scope.sequenceGroupName || ""}` : "Whole case",
    scopedIncidentCount: rows.length, activeIncidentCount: rows.filter((row) => !row.archived).length, archivedIncidentCount: rows.filter((row) => row.archived).length,
    incidentsWithLinkedEvidence: rows.filter((row) => row.linkedEvidence.length).length, incidentsWithoutLinkedEvidence: rows.filter((row) => !row.linkedEvidence.length).length,
    incidentsWithLinkedDocuments: rows.filter((row) => row.linkedDocuments.length).length, incidentsWithLinkedStrategies: rows.filter((row) => row.linkedStrategies.length).length,
    incidentsWithLinkedWatch: rows.filter((row) => row.linkedWatch.length).length, incidentsWithLinkedLedger: rows.filter((row) => row.linkedLedger.length).length,
    incidentsWithUnresolvedReferences: rows.filter((row) => row.unresolvedReferenceCount).length, groupedIncidentCount: rows.filter((row) => row.sequenceGroup).length,
    ungroupedIncidentCount: rows.filter((row) => !row.sequenceGroup).length, archivedPolicy: definition?.includeArchived === false ? "excluded" : "included",
  };
  return createReportDocument({ definition, model, generatedAt: options.generatedAt, title: definition?.label || "Incident Schedule", notices, summary, sections: [
    { id: "case-overview", heading: "Case Details", type: "summary", metadata: model.sourceCase || {} },
    { id: "incident-summary", heading: "Summary", type: "metrics", metadata: summary },
    { id: "incident-schedule", heading: "Incident Schedule", type: "table", rows },
    { id: "evidence-coverage", heading: "Evidence Coverage", type: "table", rows: coverage },
    { id: "incident-quality-findings", heading: "Weak or Incomplete Incidents", type: "diagnostics", items: findings },
    { id: "unresolved-references", heading: "Unresolved References", type: "diagnostics", items: unresolved },
    { id: "notices", heading: "Notices", type: "narrative", items: notices },
  ] });
}
