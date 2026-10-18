import { buildCaseAuditDocument } from "./caseAuditDocument.js";
import { createReportDocument, getReportDocumentSection } from "./reportDocument.js";
import { getReportDefinition } from "./reportDefinitions.js";

const TYPE_LABELS = { incident: "Incident", evidence: "Evidence", document: "Document", ledger: "Ledger", strategy: "Strategy", watch: "To Watch" };

function section(document, id) { return getReportDocumentSection(document, id) || {}; }
function reference(record) { return { recordType: record.type, recordId: record.id, title: record.title || "Untitled record", label: `${TYPE_LABELS[record.type] || record.type}: ${record.id} — ${record.title || "Untitled record"}` }; }
function sourceFor(records, type, id) { return records.find((record) => record.type === type && record.id === id) || null; }
function recordClassification(record) {
  if (record.type === "incident") return "Recorded incident or allegation — not independently established";
  if (record.type === "evidence") return `Recorded evidence — verification status: ${record.details?.verificationStatus || record.status || "not recorded"}`;
  if (record.type === "document") return "Recorded document — contents are not reproduced in this report";
  return `Recorded ${TYPE_LABELS[record.type] || record.type.toLowerCase()}`;
}
function actionRows(records) {
  return records.flatMap((record) => {
    if (record.type === "strategy") return (record.details?.nextSteps || []).map((action, index) => ({ id: `${record.id}:step:${index}`, text: action, sourceReference: reference(record), classification: "Recorded Strategy next step" }));
    if (record.type === "watch" && record.details?.reviewDate) return [{ id: `${record.id}:review`, text: `Review ${record.title} by ${record.details.reviewDate}.`, sourceReference: reference(record), classification: "Recorded review" }];
    return [];
  });
}

export function buildExecutiveReportDocument(reportModel, definition = getReportDefinition("executive"), options = {}) {
  const model = reportModel && typeof reportModel === "object" ? reportModel : {};
  const generatedAt = options.generatedAt || model.generatedAt || new Date(0).toISOString();
  const records = model.records?.primaryScopedRecords || [];
  const selectedIssue = model.scope?.type === "sequenceGroup" ? (model.sequenceGroups || []).find((issue) => issue.issueId === model.scope.issueId) : null;
  const scopeLabel = model.scope?.type === "sequenceGroup" ? (model.scope.displayLabel || selectedIssue?.displayLabel || model.scope.sequenceGroupName || "Selected Issue") : "Whole case";
  const audit = buildCaseAuditDocument(model, getReportDefinition("caseAudit"), { generatedAt });
  const auditFindings = section(audit, "findings-by-severity").items || [];
  const facts = records.filter((record) => ["incident", "document"].includes(record.type)).slice(0, 6).map((record) => ({ id: `${record.type}:${record.id}`, title: record.title, summary: record.summary || "", classification: recordClassification(record), sourceReference: reference(record) }));
  const evidence = records.filter((record) => record.type === "evidence").sort((left, right) => Number(Boolean(right.details?.verificationStatus || right.status)) - Number(Boolean(left.details?.verificationStatus || left.status))).slice(0, 5).map((record) => ({ id: record.id, title: record.title, functionSummary: record.details?.functionSummary || record.summary || "", classification: recordClassification(record), sourceReference: reference(record) }));
  const unresolvedReferences = (model.unresolvedReferences || []).map((item, index) => {
    const source = sourceFor(records, item.sourceRecordType, item.sourceRecordId);
    return { id: `${item.sourceRecordType}:${item.sourceRecordId}:${item.targetId}:${index}`, text: item.message || "A structured reference could not be resolved.", classification: "Unresolved structured reference", sourceReference: source ? reference(source) : { recordType: item.sourceRecordType || "record", recordId: item.sourceRecordId || "", title: "Unavailable source record", label: `Unavailable source record: ${item.sourceRecordType || "record"} ${item.sourceRecordId || "not recorded"}` }, targetId: item.targetId || "" };
  });
  const questions = auditFindings.filter((item) => item.severity !== "information").slice(0, 6).map((item, index) => {
    const source = sourceFor(records, item.recordType, item.recordId);
    return { id: `${item.code || "finding"}:${item.recordId || index}`, text: item.message, classification: "Unresolved data-quality matter", sourceReference: source ? reference(source) : null };
  });
  const interpretations = selectedIssue?.currentPosition ? [{ id: `${selectedIssue.issueId}:position`, text: selectedIssue.currentPosition, classification: "User-authored interpretation / current position", sourceReference: { recordType: "issue", recordId: selectedIssue.issueId, title: selectedIssue.displayLabel, label: `Issue: ${selectedIssue.displayLabel}` } }] : [];
  const actions = actionRows(records);
  if (selectedIssue?.reviewDate) actions.unshift({ id: `${selectedIssue.issueId}:review`, text: `Review ${selectedIssue.displayLabel} by ${selectedIssue.reviewDate}.`, classification: "Recorded Issue review", sourceReference: { recordType: "issue", recordId: selectedIssue.issueId, title: selectedIssue.displayLabel, label: `Issue: ${selectedIssue.displayLabel}` } });
  const summaryText = model.scope?.isValid === false ? "The selected Issue could not be resolved. No Issue records are included." : records.length ? `This concise briefing summarises ${records.length} structured record(s) in ${scopeLabel}. It distinguishes recorded material, user-authored interpretation, and unresolved matters; it does not determine what is proven.` : `${scopeLabel} currently has no directly assigned records. This does not establish that no relevant material exists.`;
  const notices = [{ code: "FACTUAL_SCOPE", severity: "info", message: "This Executive Report summarises structured records. It does not determine legal merit, credibility, or whether an allegation is proven." }, { code: "SOURCE_LIMITATION", severity: "info", message: "References identify ProveIt records, not independent proof. Original attachment content is not reproduced." }];
  const report = createReportDocument({ definition, model, generatedAt, title: model.scope?.type === "sequenceGroup" ? `Executive Report — ${scopeLabel}` : "Executive Report", notices, summary: { scopeLabel, issue: selectedIssue ? { id: selectedIssue.issueId, reference: selectedIssue.issueReference, name: selectedIssue.issueName, displayLabel: selectedIssue.displayLabel, status: selectedIssue.status, priority: selectedIssue.priority, purpose: selectedIssue.purpose } : null, directRecordCount: records.length, unresolvedReferenceCount: unresolvedReferences.length, unresolvedMatterCount: questions.length }, sections: [
    { id: "issue-overview", heading: "Issue Overview", type: "overview", metadata: selectedIssue ? { displayLabel: selectedIssue.displayLabel, purpose: selectedIssue.purpose, status: selectedIssue.status, priority: selectedIssue.priority, reviewDate: selectedIssue.reviewDate } : { scope: scopeLabel }, text: summaryText },
    { id: "key-findings", heading: "Key Findings and Relevant Facts", type: "records", items: facts },
    { id: "recorded-interpretations", heading: "Recorded Interpretations", type: "interpretations", items: interpretations },
    { id: "supporting-evidence", heading: "Significant Supporting Evidence", type: "evidence", items: evidence, metadata: { selectionNote: "Concise list of directly scoped Evidence records. Significance is not a credibility or weight assessment." } },
    { id: "contradictions-and-questions", heading: "Contradictions and Unresolved Questions", type: "unresolved", metadata: { contradictionNote: "ProveIt has no structured contradiction assessment. This section does not infer contradictions." }, groups: [{ id: "contradictions", label: "Contradictions", items: [] }, { id: "unresolved-references", label: "Unresolved references", items: unresolvedReferences }, { id: "data-quality-questions", label: "Unresolved questions", items: questions }] },
    { id: "recommended-next-steps", heading: "Recommended Next Steps", type: "actions", items: actions, metadata: { limitation: "Only existing structured next steps and review dates are shown; no new advice is generated." } },
  ] });
  return { ...report, presentation: { purpose: "Provide a concise, traceable briefing for the declared Issue or case scope.", audience: "Case owner / adviser / manager", scope: scopeLabel, reportingPeriod: "Current case state at generation time", exclusions: "This concise report does not reproduce every record or original attachment.", completeness: "Concise summary of the declared structured scope", documentStatus: options.documentStatus || "Draft", confidentiality: options.confidentiality || "Confidential", version: options.version || "1.0", preparedBy: options.preparedBy || "", approvedBy: options.approvedBy || "", aiAssistance: "None" } };
}
