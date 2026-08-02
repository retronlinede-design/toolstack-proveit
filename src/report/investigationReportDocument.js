import { buildCaseAuditDocument } from "./caseAuditDocument.js";
import { buildChronologyReportDocument } from "./chronologyReportDocument.js";
import { buildDocumentScheduleDocument } from "./documentScheduleDocument.js";
import { buildEvidenceScheduleDocument } from "./evidenceScheduleDocument.js";
import { buildIncidentScheduleDocument } from "./incidentScheduleDocument.js";
import { buildLedgerScheduleDocument } from "./ledgerScheduleDocument.js";
import { createReportDocument, getReportDocumentSection } from "./reportDocument.js";
import { getReportDefinition } from "./reportDefinitions.js";

const TYPES = ["incident", "evidence", "document", "ledger", "strategy", "watch"];
const TYPE_LABELS = { incident: "Incidents", evidence: "Evidence", document: "Documents", ledger: "Ledger", strategy: "Strategy", watch: "To Watch" };
function ref(record) { return `${record.type}:${record.id}`; }
function unique(items, key = (item) => item.id) { return [...new Map(items.filter(Boolean).map((item) => [key(item), item])).values()]; }
function countBy(items, getter) { const result = {}; items.forEach((item) => { const key = getter(item) || "Not recorded"; result[key] = (result[key] || 0) + 1; }); return Object.entries(result).map(([label, count]) => ({ label, count })); }
function section(document, id) { return getReportDocumentSection(document, id) || {}; }

function linkedContext(model) {
  if (model.scope?.type !== "sequenceGroup") return [];
  const direct = model.records?.primaryScopedRecords || [];
  const directIds = new Set(direct.map((record) => record.id));
  const linkedIds = new Set();
  direct.forEach((record) => (record.links || []).filter((link) => link.status === "resolved").forEach((link) => linkedIds.add(link.targetId)));
  (model.records?.all || []).forEach((record) => {
    if ((record.links || []).some((link) => link.status === "resolved" && directIds.has(link.targetId))) linkedIds.add(record.id);
  });
  return unique((model.records?.all || []).filter((record) => linkedIds.has(record.id) && !directIds.has(record.id)), ref);
}

function actionRows(records, issueLabel) {
  const actions = [];
  records.filter((record) => record.type === "strategy").forEach((record) => {
    const owner = (record.resolvedParties || []).find((party) => party.id === record.details?.ownerPartyId)?.name || "";
    (record.details?.nextSteps || []).forEach((action, index) => actions.push({ id: `${record.id}:step:${index}`, action, sourceType: "Strategy", sourceId: record.id, sourceTitle: record.title, issueLabel, owner, dueDate: record.details?.reviewDate || "", status: record.status || "" }));
    if (record.details?.reviewDate) actions.push({ id: `${record.id}:review`, action: `Review ${record.title}`, sourceType: "Strategy review", sourceId: record.id, sourceTitle: record.title, issueLabel, owner, dueDate: record.details.reviewDate, status: record.status || "" });
  });
  records.filter((record) => record.type === "watch" && record.details?.reviewDate).forEach((record) => actions.push({ id: `${record.id}:review`, action: `Review monitored matter: ${record.title}`, sourceType: "To Watch review", sourceId: record.id, sourceTitle: record.title, issueLabel, owner: "", dueDate: record.details.reviewDate, status: record.status || "" }));
  return actions.sort((a, b) => (a.dueDate || "9999").localeCompare(b.dueDate || "9999") || a.action.localeCompare(b.action));
}

export function buildInvestigationReportDocument(reportModel, definition = getReportDefinition("investigation"), options = {}) {
  const model = reportModel && typeof reportModel === "object" ? reportModel : {};
  const generatedAt = options.generatedAt || model.generatedAt || new Date(0).toISOString();
  const incident = buildIncidentScheduleDocument(model, getReportDefinition("incidentSchedule"), { generatedAt });
  const chronology = buildChronologyReportDocument(model, getReportDefinition("chronologyReport"), { generatedAt });
  const evidence = buildEvidenceScheduleDocument(model, getReportDefinition("evidence"), { generatedAt });
  const documents = buildDocumentScheduleDocument(model, getReportDefinition("document"), { generatedAt });
  const ledger = buildLedgerScheduleDocument(model, getReportDefinition("ledger"), { generatedAt });
  const audit = buildCaseAuditDocument(model, getReportDefinition("caseAudit"), { generatedAt });
  const records = model.records?.primaryScopedRecords || [];
  const linked = linkedContext(model);
  const selectedIssue = model.scope?.type === "sequenceGroup" ? (model.sequenceGroups || []).find((item) => item.issueId === model.scope.issueId || item.name === model.scope.sequenceGroupName) : null;
  const scopeLabel = model.scope?.type === "sequenceGroup" ? (model.scope.displayLabel || selectedIssue?.displayLabel || model.scope.sequenceGroupName || "Selected Issue") : "Whole case";
  const owner = selectedIssue?.ownerPartyId ? (model.parties || []).find((party) => party.id === selectedIssue.ownerPartyId) : null;
  const chronologyGroups = section(chronology, "chronology").groups || [];
  const allChronologyEntries = chronologyGroups.flatMap((group) => group.entries || []);
  const validDates = allChronologyEntries.filter((item) => item.dateStatus === "valid").map((item) => item.date);
  const reportingPeriod = validDates.length ? `${validDates[0]} to ${validDates.at(-1)}` : "No valid record dates available";
  const incidentRows = section(incident, "incident-schedule").rows || [];
  const coverage = section(incident, "evidence-coverage").rows || [];
  const evidenceRows = section(evidence, "evidence-schedule").rows || [];
  const documentRows = section(documents, "document-schedule").rows || [];
  const ledgerRows = section(ledger, "ledger-schedule").rows || [];
  const auditFindings = section(audit, "findings-by-severity").items || [];
  const unresolved = unique(model.unresolvedReferences || [], (item) => `${item.sourceRecordType}:${item.sourceRecordId}:${item.targetId}`);
  const issueLabel = model.scope?.type === "sequenceGroup" ? scopeLabel : "";
  const actions = actionRows(records, issueLabel);
  if (selectedIssue?.reviewDate) actions.unshift({ id: `${selectedIssue.id}:review`, action: `Review ${scopeLabel}`, sourceType: "Issue review", sourceId: selectedIssue.id, sourceTitle: scopeLabel, issueLabel: scopeLabel, owner: owner?.name || "", dueDate: selectedIssue.reviewDate, status: selectedIssue.status || "" });
  const findings = [
    { id: "evidence-coverage", text: `${coverage.filter((item) => item.supportingEvidenceCount > 0).length} of ${incidentRows.length} Incidents have one or more structured Evidence associations.` },
    ...(coverage.filter((item) => item.supportingEvidenceCount === 0).length ? [{ id: "unsupported-incidents", text: `${coverage.filter((item) => item.supportingEvidenceCount === 0).length} Incident(s) have no structured Evidence association.` }] : []),
    ...(unresolved.length ? [{ id: "unresolved-references", text: `${unresolved.length} structured reference(s) could not be resolved in the selected scope.` }] : []),
    ...(chronology.summary?.malformedDateCount ? [{ id: "malformed-dates", text: `${chronology.summary.malformedDateCount} record(s) have malformed primary dates.` }] : []),
    ...(chronology.summary?.missingDateCount ? [{ id: "missing-dates", text: `${chronology.summary.missingDateCount} record(s) have no primary chronology date.` }] : []),
    ...(records.filter((record) => record.type === "strategy" && !record.archived).length ? [{ id: "open-strategy", text: `${records.filter((record) => record.type === "strategy" && !record.archived).length} non-archived Strategy record(s) are included.` }] : []),
    ...(records.filter((record) => record.type === "watch" && !record.archived).length ? [{ id: "open-watch", text: `${records.filter((record) => record.type === "watch" && !record.archived).length} non-archived To Watch record(s) are included.` }] : []),
  ];
  const evidenceGaps = auditFindings.filter((item) => /EVIDENCE|ATTACHMENT|PROOF/.test(item.code));
  const dateGaps = auditFindings.filter((item) => /DATE/.test(item.code));
  const linkGaps = auditFindings.filter((item) => /LINK|REFERENCE|PARTY/.test(item.code));
  const reviewGaps = auditFindings.filter((item) => /REVIEW/.test(item.code));
  const title = model.scope?.type === "sequenceGroup" ? `Investigation Report — ${scopeLabel}` : "Investigation Report";
  const summaryText = records.length
    ? `This report presents the structured investigation record for ${scopeLabel}. It includes ${model.totals?.byType?.incident || 0} Incidents, ${model.totals?.byType?.evidence || 0} Evidence records, ${model.totals?.byType?.document || 0} Documents, ${model.totals?.byType?.ledger || 0} Ledger records, and ${auditFindings.length} deterministic data-quality finding(s), covering ${reportingPeriod}.`
    : model.scope?.type === "sequenceGroup" && model.scope?.isValid ? `${scopeLabel} exists but currently contains no directly assigned investigation records.` : model.scope?.type === "sequenceGroup" ? "The selected Issue could not be resolved." : "No investigation records are available in this case.";
  const notices = [
    { code: "FACTUAL_SCOPE", severity: "info", message: "This report describes structured case records and relationships. It does not determine legal merit or whether an allegation is proven." },
    { code: "ARCHIVE_POLICY", severity: "info", message: definition?.includeArchived === false ? "Archived records are excluded." : "Archived records are included in the declared scope." },
    ...(model.scope?.type === "sequenceGroup" ? [{ code: "ISSUE_SCOPE", severity: "info", message: "Directly assigned Issue records form the primary scope. Permitted linked context is identified separately and is not treated as direct Issue membership." }] : []),
  ];
  const appendices = [
    { id: "appendix-incidents", label: "Appendix A", title: "Complete Incident Schedule", type: "incident-schedule", rows: incidentRows },
    { id: "appendix-chronology", label: "Appendix B", title: "Complete Chronology", type: "chronology", groups: chronologyGroups },
    ...(evidenceRows.length ? [{ id: "appendix-evidence", label: "Appendix C", title: "Evidence Schedule", type: "evidence-schedule", rows: evidenceRows }] : []),
    ...(documentRows.length ? [{ id: "appendix-documents", label: "Appendix D", title: "Document Schedule", type: "document-schedule", rows: documentRows }] : []),
    ...(ledgerRows.length ? [{ id: "appendix-ledger", label: "Appendix E", title: "Ledger Schedule", type: "ledger-schedule", rows: ledgerRows }] : []),
    ...(auditFindings.length ? [{ id: "appendix-audit", label: "Appendix F", title: "Audit Findings", type: "audit-findings", items: auditFindings }] : []),
    { id: "appendix-references", label: "Appendix G", title: "Technical Reference Index", type: "reference-index", items: records.map((record) => ({ recordType: record.type, recordId: record.id, title: record.title, scopeRelation: "direct" })).concat(linked.map((record) => ({ recordType: record.type, recordId: record.id, title: record.title, scopeRelation: "linked-context" }))) },
  ];
  const report = createReportDocument({ definition, model, generatedAt, title, notices, summary: { scopeLabel, summaryText, reportingPeriod, statistics: { ...model.totals?.byType, parties: model.parties?.length || 0, linkedContext: linked.length, unresolvedReferences: unresolved.length, auditFindings: auditFindings.length, archivedRecords: model.totals?.archivedRecordCount || 0 }, issue: selectedIssue ? { id: selectedIssue.issueId, reference: selectedIssue.issueReference, name: selectedIssue.issueName, displayLabel: selectedIssue.displayLabel, purpose: selectedIssue.purpose, status: selectedIssue.status, priority: selectedIssue.priority, ownerPartyId: selectedIssue.ownerPartyId, ownerName: owner?.name || "", reviewDate: selectedIssue.reviewDate, currentPosition: selectedIssue.currentPosition, updatedAt: selectedIssue.updatedAt } : null, scopeValid: model.scope?.isValid !== false, directRecordCount: records.length, linkedContextCount: linked.length, unresolvedReferenceCount: unresolved.length, auditFindingCount: auditFindings.length }, sections: [
    { id: "executive-summary", heading: "Executive Summary", type: "narrative", text: summaryText },
    { id: "current-position", heading: "Current Position", type: "authored-position", metadata: selectedIssue ? { purpose: selectedIssue.purpose, status: selectedIssue.status, priority: selectedIssue.priority, ownerName: owner?.name || "", reviewDate: selectedIssue.reviewDate, currentPosition: selectedIssue.currentPosition, updatedAt: selectedIssue.updatedAt } : { currentPosition: "", source: "No reliable whole-case current focus is projected into the report model." } },
    { id: "snapshot", heading: "Investigation Snapshot", type: "metrics", metadata: { ...model.totals?.byType, parties: model.parties?.length || 0, linkedContext: linked.length, unresolvedReferences: unresolved.length, auditFindings: auditFindings.length, archivedRecords: model.totals?.archivedRecordCount || 0 } },
    { id: "key-findings", heading: "Key Findings", type: "findings", items: findings },
    { id: "narrative-chronology", heading: "Narrative Chronology", type: "chronology", groups: chronologyGroups.map((group) => ({ ...group, entries: (group.entries || []).slice(0, 8) })), metadata: { completeChronologyAppendixId: "appendix-chronology" } },
    { id: "evidence-overview", heading: "Evidence Overview", type: "overview", metadata: { total: evidenceRows.length, types: countBy(evidenceRows, (row) => row.evidenceType || row.evidenceRole), verificationStates: countBy(evidenceRows, (row) => row.verificationState), linked: evidenceRows.filter((row) => row.linkedIncidentIds?.length).length, unlinked: evidenceRows.filter((row) => !row.linkedIncidentIds?.length).length, withAttachments: evidenceRows.filter((row) => row.attachmentCount > 0).length, unresolvedReferences: section(evidence, "unresolved-references").items?.length || 0 }, items: evidenceRows.slice(0, 10).map((row) => ({ id: row.evidenceId, title: row.title, functionSummary: row.functionSummary, verificationState: row.verificationState, linkedIncidentTitles: row.linkedIncidentTitles })) },
    { id: "supporting-documents", heading: "Supporting Documents", type: "overview", metadata: { total: documentRows.length, categories: countBy(documentRows, (row) => row.documentType || row.category), linked: documentRows.filter((row) => row.linkedIncidents?.length || row.linkedEvidence?.length).length, withAttachments: documentRows.filter((row) => row.attachmentCount > 0 || row.attachmentNames?.length).length, unresolvedReferences: section(documents, "unresolved-references").items?.length || 0 }, items: documentRows.slice(0, 10).map((row) => ({ id: row.documentId, title: row.title, summary: row.summary || row.notes || row.functionSummary, category: row.documentType || row.category })) },
    ...(ledgerRows.length ? [{ id: "financial-position", heading: "Financial / Ledger Position", type: "financial", metadata: { totalsByCurrency: ledger.summary?.totalsByCurrency || [], monetaryEntryCount: ledger.summary?.monetaryEntryCount || 0, statusNoteCount: ledger.summary?.excludedStatusNoteCount || 0 }, items: ledgerRows.slice(0, 10) }] : []),
    { id: "people-involved", heading: "People Involved", type: "people", items: (model.parties || []).map((party) => { const appearances = records.filter((record) => record.partyIds?.includes(party.id)); return { id: party.id, name: party.name, role: party.role, organisation: party.organisation, directRecordAppearances: appearances.length, recordTypes: [...new Set(appearances.map((record) => record.type))] }; }).filter((party) => party.directRecordAppearances > 0), metadata: { unresolvedPartyReferences: unresolved.filter((item) => item.referenceType === "party") } },
    { id: "outstanding-matters", heading: "Outstanding Matters", type: "grouped-findings", groups: [{ id: "evidence-gaps", label: "Evidence gaps", items: evidenceGaps }, { id: "record-quality", label: "Record-quality gaps", items: dateGaps }, { id: "reviews", label: "Outstanding responses or reviews", items: reviewGaps }, { id: "links", label: "Structural link issues", items: linkGaps.concat(unresolved) }] },
    { id: "next-actions", heading: "Next Actions", type: "actions", items: actions, metadata: { dataQualityRemediation: auditFindings.filter((item) => item.severity !== "information") } },
  ] });
  return { ...report, presentation: { purpose: "Explain the investigation and its current position.", audience: "Investigator / adviser / manager", scope: scopeLabel, reportingPeriod, exclusions: model.scope?.type === "sequenceGroup" ? "Records outside direct Issue membership are included only as labelled linked context. Attachment binaries are not embedded." : "Attachment binaries are not embedded.", completeness: "Complete for the declared structured scope", archivePolicy: definition?.includeArchived === false ? "Archived records excluded" : "Archived records included", documentStatus: options.documentStatus || "Draft", confidentiality: options.confidentiality || "Confidential", version: options.version || "1.0", preparedBy: options.preparedBy || "", approvedBy: options.approvedBy || "", aiAssistance: "None" }, recordReferences: { direct: records.map((record) => ({ type: record.type, id: record.id, title: record.title })), linkedContext: linked.map((record) => ({ type: record.type, id: record.id, title: record.title })) }, unresolvedReferences: unresolved, appendices };
}
