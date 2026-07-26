import { createReportDocument } from "./reportDocument.js";

const CATEGORY_DEFINITIONS = Object.freeze([
  ["record-completeness", "Record Completeness"], ["date-quality", "Date Quality"],
  ["link-integrity", "Link Integrity"], ["party-integrity", "Party Integrity"],
  ["attachment-proof-metadata", "Attachment and Proof Metadata"], ["sequence-group-coverage", "Sequence Group Coverage"],
  ["ledger-integrity", "Ledger Integrity"], ["strategy-completeness", "Strategy Completeness"],
  ["archive-visibility", "Archive Visibility"], ["case-metadata", "Case-level Metadata"],
]);
const SUPPORTED_TYPES = ["incident", "evidence", "document", "ledger", "strategy", "watch"];
const ACTIVE_STATUSES = new Set(["active", "open", "pending", "in progress", "in-progress"]);
const SEVERITY_RANK = { critical: 0, warning: 1, information: 2 };

function text(value) { return typeof value === "string" ? value.trim() : ""; }
function findingId(code, recordType = "case", recordId = "case", field = "") { return [code, recordType, recordId || "missing", field].filter(Boolean).join(":").toLowerCase().replace(/[^a-z0-9:-]+/g, "-"); }
function severityTotals(findings) { return { critical: findings.filter((item) => item.severity === "critical").length, warning: findings.filter((item) => item.severity === "warning").length, information: findings.filter((item) => item.severity === "information").length }; }
function parseAmount(value) { if (value === "" || value == null) return { present: false, valid: false, value: null }; const parsed = typeof value === "number" ? value : Number(String(value).replace(/,/g, "")); return { present: true, valid: Number.isFinite(parsed), value: Number.isFinite(parsed) ? parsed : null }; }
function isStatusNote(record) { return record.details?.isStatusNote === true || Boolean(text(record.details?.statusNote)) || text(record.details?.type).toLowerCase() === "status note"; }
function isActive(record) { const status = text(record.status).toLowerCase(); return !record.archived && (!status || ACTIVE_STATUSES.has(status)); }
function titleMissing(record) { return !record.id || record.title === record.id || /^Untitled\s/i.test(record.title || ""); }
function contextualLinks(record) { return (record.links || []).filter((link) => link.status === "resolved" && link.targetId !== record.id); }

function createCollector() {
  const findings = new Map();
  return {
    add({ code, category, severity = "warning", record = null, title = "", message, field = "", relatedRecordIds = [] }) {
      const recordType = record?.type || "case"; const recordId = record?.id || ""; const id = findingId(code, recordType, recordId, field);
      if (!findings.has(id)) findings.set(id, { id, code, category, severity, recordType, recordId, title: title || record?.title || "Case", message, field, relatedRecordIds: [...new Set(relatedRecordIds.filter(Boolean))], sequenceGroup: record?.sequenceGroup || "", archived: record?.archived === true });
    },
    values() { return [...findings.values()].sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || a.category.localeCompare(b.category) || a.code.localeCompare(b.code) || a.recordType.localeCompare(b.recordType) || a.recordId.localeCompare(b.recordId)); },
  };
}

function auditCommon(record, collector) {
  if (titleMissing(record)) collector.add({ code: "RECORD_MISSING_TITLE", category: "record-completeness", severity: "warning", record, field: "title", message: "Record has no explicit title." });
  if (record.dateStatus === "missing") collector.add({ code: "RECORD_MISSING_PRIMARY_DATE", category: "date-quality", severity: "warning", record, field: "canonicalDate", message: "Record has no primary date available to the canonical chronology." });
  if (record.dateStatus === "malformed") collector.add({ code: "RECORD_MALFORMED_PRIMARY_DATE", category: "date-quality", severity: "critical", record, field: "canonicalDate", message: "Record primary date is malformed and cannot be ordered reliably." });
  if (!text(record.status)) collector.add({ code: "RECORD_MISSING_STATUS", category: "record-completeness", severity: "information", record, field: "status", message: "Record has no status." });
  if (!record.sequenceGroup) collector.add({ code: "RECORD_UNGROUPED", category: "sequence-group-coverage", severity: "information", record, field: "sequenceGroup", message: "Record is not assigned to a Sequence Group." });
  if (record.archived) collector.add({ code: "ARCHIVED_RECORD_INCLUDED", category: "archive-visibility", severity: "information", record, message: "Archived record is included by the report archive policy." });
  const linkRefs = record.linkReferences || [];
  if (linkRefs.some((link) => link.targetId === record.id)) collector.add({ code: "RECORD_SELF_LINK", category: "link-integrity", severity: "warning", record, relatedRecordIds: [record.id], message: "Record contains a structured link to itself." });
  const duplicateTargets = [...new Set(linkRefs.map((link) => link.targetId).filter((id, index, all) => all.indexOf(id) !== index))];
  if (duplicateTargets.length) collector.add({ code: "RECORD_DUPLICATE_LINK", category: "link-integrity", severity: "warning", record, relatedRecordIds: duplicateTargets, message: "Record contains the same target in more than one structured link field." });
  (record.attachmentMetadata || []).forEach((attachment, index) => {
    if (!attachment.id) collector.add({ code: "ATTACHMENT_MISSING_ID", category: "attachment-proof-metadata", severity: "warning", record, field: `attachments.${index}.id`, message: "Attachment metadata has no stable ID." });
    if (!attachment.filename) collector.add({ code: "ATTACHMENT_MISSING_FILENAME", category: "attachment-proof-metadata", severity: "warning", record, field: `attachments.${index}.filename`, message: "Attachment metadata has no filename." });
    if (!attachment.mimeType) collector.add({ code: "ATTACHMENT_MISSING_MIME_TYPE", category: "attachment-proof-metadata", severity: "information", record, field: `attachments.${index}.mimeType`, message: "Attachment metadata has no MIME type." });
  });
  const attachments = record.attachmentMetadata || [];
  const duplicateAttachments = attachments.filter((item, index) => attachments.findIndex((candidate) => (item.id && candidate.id === item.id) || (item.filename && candidate.filename === item.filename)) !== index);
  if (duplicateAttachments.length) collector.add({ code: "ATTACHMENT_DUPLICATE_METADATA", category: "attachment-proof-metadata", severity: "warning", record, relatedRecordIds: duplicateAttachments.map((item) => item.id), message: "Duplicate attachment metadata appears on this record." });
}

function auditByType(record, collector, generatedAt) {
  const noLinks = contextualLinks(record).length === 0;
  if (record.type === "incident") {
    if (!record.summary && !text(record.details?.functionSummary)) collector.add({ code: "INCIDENT_MISSING_DESCRIPTION", category: "record-completeness", severity: "warning", record, message: "Incident has no description or function summary." });
    if (!(record.links || []).some((link) => link.status === "resolved" && link.targetType === "evidence")) collector.add({ code: "INCIDENT_NO_LINKED_EVIDENCE", category: "link-integrity", severity: "information", record, message: "Incident has no resolved structured evidence link." });
    if (Object.hasOwn(record.details || {}, "outcome") && !text(record.details.outcome)) collector.add({ code: "INCIDENT_MISSING_OUTCOME", category: "record-completeness", severity: "information", record, field: "outcome", message: "Incident outcome field is blank." });
  }
  if (record.type === "evidence") {
    if (!text(record.details?.evidenceType) && !text(record.details?.evidenceRole)) collector.add({ code: "EVIDENCE_MISSING_TYPE", category: "record-completeness", severity: "warning", record, field: "evidenceType", message: "Evidence has no type or role." });
    if (!text(record.details?.source) && !text(record.details?.acquisitionNotes) && !text(record.details?.chainOfCustody)) collector.add({ code: "EVIDENCE_MISSING_PROVENANCE", category: "attachment-proof-metadata", severity: "warning", record, message: "Evidence has no projected source, acquisition, or custody metadata." });
    if (noLinks) collector.add({ code: "EVIDENCE_NO_CONTEXT_LINK", category: "link-integrity", severity: "warning", record, message: "Evidence has no resolved structured record context." });
  }
  if (record.type === "document") {
    if (!text(record.details?.documentType) && !text(record.details?.category)) collector.add({ code: "DOCUMENT_MISSING_TYPE", category: "record-completeness", severity: "warning", record, field: "documentType", message: "Document has no document type or category." });
    if (noLinks) collector.add({ code: "DOCUMENT_NO_CONTEXT_LINK", category: "link-integrity", severity: "information", record, message: "Document has no resolved structured case context." });
    if (!(record.attachmentMetadata || []).length) collector.add({ code: "DOCUMENT_NO_ATTACHMENT_METADATA", category: "attachment-proof-metadata", severity: "information", record, message: "Document has no attachment metadata." });
  }
  if (record.type === "strategy") {
    for (const [field, code, label] of [["objective", "STRATEGY_MISSING_OBJECTIVE", "objective"], ["rationale", "STRATEGY_MISSING_RATIONALE", "rationale"], ["desiredOutcome", "STRATEGY_MISSING_DESIRED_OUTCOME", "desired outcome"], ["decisionStatus", "STRATEGY_MISSING_DECISION_STATUS", "decision status"]]) if (!text(record.details?.[field])) collector.add({ code, category: "strategy-completeness", severity: "warning", record, field, message: `Strategy has no ${label}.` });
    if (!record.details?.ownerPartyId) collector.add({ code: "STRATEGY_MISSING_OWNER", category: "strategy-completeness", severity: "information", record, field: "ownerPartyId", message: "Strategy has no assigned owner." });
    if (isActive(record) && (!Array.isArray(record.details?.nextSteps) || record.details.nextSteps.length === 0)) collector.add({ code: "STRATEGY_ACTIVE_NO_NEXT_STEPS", category: "strategy-completeness", severity: "warning", record, field: "nextSteps", message: "Active strategy has no structured next steps." });
  }
  if (record.type === "watch") {
    if (noLinks) collector.add({ code: "WATCH_NO_CONTEXT_LINK", category: "link-integrity", severity: "information", record, message: "To Watch record has no resolved structured case context." });
  }
  const reviewDate = text(record.details?.reviewDate);
  if (reviewDate && isActive(record)) { const parsed = Date.parse(reviewDate); const now = Date.parse(generatedAt); if (!Number.isNaN(parsed) && !Number.isNaN(now) && parsed < now) collector.add({ code: `${record.type.toUpperCase()}_REVIEW_PAST_DUE`, category: record.type === "strategy" ? "strategy-completeness" : "date-quality", severity: "warning", record, field: "reviewDate", message: "Active record has a structured review date in the past." }); }
}

function auditLedger(record, collector, currencyTotals) {
  const statusNote = isStatusNote(record); const amount = parseAmount(record.details?.amount ?? record.details?.expectedAmount ?? record.details?.paidAmount); const currency = text(record.details?.currency).toUpperCase(); const status = text(record.status).toLowerCase();
  if (statusNote && amount.present) collector.add({ code: "LEDGER_STATUS_NOTE_HAS_AMOUNT", category: "ledger-integrity", severity: "warning", record, field: "amount", message: "Ledger status note contains a monetary value." });
  if (!statusNote && !amount.present) collector.add({ code: "LEDGER_MISSING_AMOUNT", category: "ledger-integrity", severity: "critical", record, field: "amount", message: "Monetary Ledger record has no amount." });
  if (amount.present && !amount.valid) collector.add({ code: "LEDGER_MALFORMED_AMOUNT", category: "ledger-integrity", severity: "critical", record, field: "amount", message: "Ledger amount is not a valid stored number." });
  if (!statusNote && amount.present && amount.valid && !currency) collector.add({ code: "LEDGER_MISSING_CURRENCY", category: "ledger-integrity", severity: "warning", record, field: "currency", message: "Monetary Ledger record has no currency." });
  if (currency && !/^[A-Z]{3}$/.test(currency)) collector.add({ code: "LEDGER_UNRECOGNISED_CURRENCY_LABEL", category: "ledger-integrity", severity: "warning", record, field: "currency", message: "Ledger currency label does not use a three-letter structured code." });
  if (!text(record.status)) collector.add({ code: "LEDGER_MISSING_PAYMENT_STATUS", category: "ledger-integrity", severity: "warning", record, field: "status", message: "Ledger record has no payment status." });
  if (!statusNote && !text(record.details?.proofStatus) && !text(record.details?.proofType)) collector.add({ code: "LEDGER_MISSING_PROOF_STATE", category: "attachment-proof-metadata", severity: "warning", record, field: "proofStatus", message: "Monetary Ledger record has no proof state or proof type." });
  if (["pending", "disputed", "waived"].includes(status)) collector.add({ code: `LEDGER_${status.toUpperCase()}_ENTRY`, category: "ledger-integrity", severity: "information", record, field: "status", message: `Ledger record has ${status} status and remains visible for review.` });
  if (amount.valid && currency) { const bucket = currencyTotals.get(currency) || { currency, debit: 0, credit: 0, total: 0, pending: 0, disputed: 0, waived: 0, recordCount: 0 }; const direction = ["credit", "income", "payment received"].includes(text(record.details?.type).toLowerCase()) ? "credit" : "debit"; bucket[direction] += amount.value; bucket.total += amount.value; if (["pending", "disputed", "waived"].includes(status)) bucket[status] += amount.value; bucket.recordCount += 1; currencyTotals.set(currency, bucket); }
}

export function buildCaseAuditDocument(reportModel, definition, options = {}) {
  const model = reportModel && typeof reportModel === "object" ? reportModel : {}; const records = model.records?.primaryScopedRecords || []; const allRecords = model.records?.all || []; const collector = createCollector(); const generatedAt = options.generatedAt || model.generatedAt || new Date(0).toISOString(); const currencyTotals = new Map();
  if (!text(model.sourceCase?.name)) collector.add({ code: "CASE_MISSING_NAME", category: "case-metadata", severity: "critical", field: "name", message: "Case has no name." });
  if (!text(model.sourceCase?.status)) collector.add({ code: "CASE_MISSING_STATUS", category: "case-metadata", severity: "warning", field: "status", message: "Case has no status." });
  if (!text(model.sourceCase?.category)) collector.add({ code: "CASE_MISSING_CATEGORY", category: "case-metadata", severity: "information", field: "category", message: "Case has no category." });
  records.forEach((record) => { auditCommon(record, collector); auditByType(record, collector, generatedAt); if (record.type === "ledger") auditLedger(record, collector, currencyTotals); });
  (model.unresolvedReferences || []).forEach((item) => { const record = records.find((candidate) => candidate.id === item.sourceRecordId && candidate.type === item.sourceRecordType); collector.add({ code: item.referenceType === "party" ? "UNRESOLVED_PARTY_REFERENCE" : "UNRESOLVED_RECORD_REFERENCE", category: item.referenceType === "party" ? "party-integrity" : "link-integrity", severity: "critical", record, title: record?.title || "Unresolved reference", field: item.referenceType, relatedRecordIds: [item.targetId], message: item.message || "Structured reference could not be resolved." }); });
  const scopedPartyIds = new Set(records.flatMap((record) => record.partyIds || []));
  (model.parties || []).filter((party) => model.scope?.type === "case" || scopedPartyIds.has(party.id)).forEach((party) => { const partyRecord = { type: "party", id: party.id, title: party.name || "Party", sequenceGroup: "", archived: false }; if (!party.name) collector.add({ code: "PARTY_MISSING_NAME", category: "party-integrity", severity: "warning", record: partyRecord, field: "name", message: `Party ${party.id || "without ID"} has no display name.`, relatedRecordIds: [party.id] }); if (scopedPartyIds.has(party.id) && !party.role) collector.add({ code: "PARTY_MISSING_ROLE", category: "party-integrity", severity: "information", record: partyRecord, field: "role", message: "Referenced party has no role information.", relatedRecordIds: [party.id] }); });
  const duplicatePartyNames = (model.parties || []).filter((party, index, parties) => party.name && parties.findIndex((candidate) => candidate.name.toLocaleLowerCase() === party.name.toLocaleLowerCase()) !== index);
  duplicatePartyNames.forEach((party) => collector.add({ code: "PARTY_DUPLICATE_DISPLAY_NAME", category: "party-integrity", severity: "information", record: { type: "party", id: party.id, title: party.name }, field: "name", relatedRecordIds: [party.id], message: "Another party has the same normalised display name." }));
  const groupNames = new Set((model.sequenceGroups || []).filter((group) => group.registered).map((group) => group.name.toLocaleLowerCase()));
  records.filter((record) => record.sequenceGroup && !groupNames.has(record.sequenceGroup.toLocaleLowerCase())).forEach((record) => collector.add({ code: "RECORD_GROUP_METADATA_MISSING", category: "sequence-group-coverage", severity: "information", record, field: "sequenceGroup", message: "Record uses a Sequence Group label without registered metadata." }));
  (model.sequenceGroups || []).forEach((group) => { if (group.empty) collector.add({ code: group.metadataOnly ? "SEQUENCE_GROUP_METADATA_ONLY" : "SEQUENCE_GROUP_EMPTY", category: "sequence-group-coverage", severity: "information", title: group.name, field: "sequenceGroup", message: group.metadataOnly ? "Sequence Group exists as metadata and has no assigned records." : "Sequence Group contains no records." }); });
  if (model.scope?.type === "sequenceGroup") records.forEach((record) => { const crossGroup = (record.links || []).filter((link) => link.status === "resolved").map((link) => allRecords.find((target) => target.id === link.targetId)).filter((target) => target?.sequenceGroup && target.sequenceGroup.toLocaleLowerCase() !== text(model.scope.sequenceGroupName).toLocaleLowerCase()); if (crossGroup.length) collector.add({ code: "SEQUENCE_GROUP_CROSS_GROUP_LINK", category: "sequence-group-coverage", severity: "information", record, relatedRecordIds: crossGroup.map((target) => target.id), message: "Scoped record links to one or more records assigned to another Sequence Group." }); });
  if (currencyTotals.size > 1) collector.add({ code: "LEDGER_MIXED_CURRENCIES", category: "ledger-integrity", severity: "information", title: "Ledger", field: "currency", message: "Ledger scope contains multiple currencies; totals remain separated and are not converted." });
  const findings = collector.values(); const totals = severityTotals(findings); const affectedKeys = new Set(findings.filter((item) => item.recordId).map((item) => `${item.recordType}:${item.recordId}`)); const categories = CATEGORY_DEFINITIONS.map(([id, label]) => { const categoryFindings = findings.filter((item) => item.category === id); return { id, label, findings: categoryFindings, totals: severityTotals(categoryFindings) }; });
  const status = totals.critical ? "Critical structural issues detected" : totals.warning ? "Warnings require review" : totals.information ? "Informational findings only" : "No critical structural issues detected";
  const findingsByRecordType = Object.fromEntries([...SUPPORTED_TYPES, "case"].map((type) => [type, findings.filter((item) => item.recordType === type).length]));
  const summary = { caseOverview: model.sourceCase || {}, scopeLabel: model.scope?.type === "sequenceGroup" ? `Sequence Group: ${model.scope.sequenceGroupName || ""}` : "Whole case", auditStatus: status, totalFindings: findings.length, ...totals, affectedRecordCount: affectedKeys.size, unaffectedRecordCount: Math.max(0, records.length - affectedKeys.size), unresolvedReferenceCount: (model.unresolvedReferences || []).length, malformedDateCount: records.filter((record) => record.dateStatus === "malformed").length, missingDateCount: records.filter((record) => record.dateStatus === "missing").length, ungroupedRecordCount: records.filter((record) => !record.sequenceGroup).length, recordsWithoutContextualLinks: records.filter((record) => contextualLinks(record).length === 0).length, archivedRecordCount: records.filter((record) => record.archived).length, findingsByCategory: Object.fromEntries(categories.map((category) => [category.id, category.findings.length])), findingsByRecordType, scopedRecordCount: records.length, archivedPolicy: definition?.includeArchived === false ? "excluded" : "included" };
  const selectedGroup = model.scope?.type === "sequenceGroup" ? (model.sequenceGroups || []).find((group) => group.name.toLocaleLowerCase() === text(model.scope.sequenceGroupName).toLocaleLowerCase()) : null;
  const sequenceGroupCoverage = { scopeType: model.scope?.type || "case", selectedGroup: selectedGroup || null, totalGroups: (model.sequenceGroups || []).length, emptyGroups: (model.sequenceGroups || []).filter((group) => group.empty).length, metadataOnlyGroups: (model.sequenceGroups || []).filter((group) => group.metadataOnly).length, groupedRecords: records.filter((record) => record.sequenceGroup).length, ungroupedByType: Object.fromEntries(SUPPORTED_TYPES.map((type) => [type, records.filter((record) => record.type === type && !record.sequenceGroup).length])) };
  const ledgerIntegrity = { entryCount: records.filter((record) => record.type === "ledger").length, statusNoteCount: records.filter((record) => record.type === "ledger" && isStatusNote(record)).length, totalsByCurrency: [...currencyTotals.values()].sort((a, b) => a.currency.localeCompare(b.currency)), currenciesAreCombined: false };
  const notices = [
    { code: "STRUCTURED_AUDIT_ONLY", severity: "information", message: "This audit identifies structured data-quality and linkage issues only. It does not determine truth, credibility, liability or legal merit." },
    { code: "ABSENCE_NOT_PROOF", severity: "information", message: "Absence of a finding does not prove completeness." },
    { code: "LINKS_NOT_PROOF", severity: "information", message: "Structured links indicate recorded associations, not evidential proof." },
    { code: "ATTACHMENT_METADATA_ONLY", severity: "information", message: "Attachments are audited as metadata only." },
    { code: "ARCHIVED_POLICY", severity: "information", message: definition?.includeArchived === false ? "Archived records are excluded by this report policy." : "Archived records are included according to the report archive policy." },
    { code: "NO_CURRENCY_CONVERSION", severity: "information", message: "Currency amounts are never converted or combined across currencies." },
  ];
  return createReportDocument({ definition, model, generatedAt, title: definition?.label || "Case Audit Report", summary, notices, sections: [
    { id: "audit-status", heading: "Audit Status", type: "summary", metadata: { status } },
    { id: "audit-summary", heading: "Summary", type: "metrics", metadata: summary },
    { id: "findings-by-severity", heading: "Findings by Severity", type: "diagnostics", metadata: totals, items: findings },
    { id: "findings-by-category", heading: "Findings by Category", type: "diagnostics", categories },
    { id: "findings-by-record-type", heading: "Findings by Record Type", type: "metrics", metadata: findingsByRecordType },
    { id: "unresolved-references", heading: "Unresolved References", type: "diagnostics", items: model.unresolvedReferences || [] },
    { id: "sequence-group-coverage", heading: "Sequence Group Coverage", type: "summary", metadata: sequenceGroupCoverage },
    { id: "ledger-integrity", heading: "Ledger Integrity", type: "summary", metadata: ledgerIntegrity },
    { id: "notices", heading: "Notices", type: "narrative", items: notices },
  ] });
}
