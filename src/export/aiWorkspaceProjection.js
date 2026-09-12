import { projectNextActionTexts } from "../domain/nextActions.js";
import { buildIssueIndex, normalizeCaseIssues } from "../domain/issueDomain.js";
import { getStrictCalendarDate } from "../domain/caseDomain.js";
import { resolveRecordById } from "../domain/linkingResolvers.js";

export const AI_WORKSPACE_CASE_PROJECTION_VERSION = "ai-workspace-case-1.0";

const COLLECTIONS = ["issues", "parties", "incidents", "evidence", "documents", "ledger", "tasks", "strategy", "watchItems"];
const list = (value) => Array.isArray(value) ? value : [];
const text = (value) => typeof value === "string" ? value : "";
const strings = (value) => list(value).filter((item) => typeof item === "string" && item);
const bool = (value) => !!value;

// Attachments are case data, but transport/cache references and payload-bearing fields are not.
function attachmentMetadata(attachment = {}) {
  return {
    id: text(attachment.id), name: text(attachment.name || attachment.fileName), type: text(attachment.type),
    mimeType: text(attachment.mimeType), size: Number.isFinite(attachment.size) ? attachment.size : null,
    kind: text(attachment.kind), createdAt: text(attachment.createdAt), emailMeta: attachment.emailMeta && typeof attachment.emailMeta === "object" ? { subject: text(attachment.emailMeta.subject), from: text(attachment.emailMeta.from), to: text(attachment.emailMeta.to), date: text(attachment.emailMeta.date) } : null,
  };
}

function baseRecord(record = {}) {
  return {
    id: text(record.id), type: text(record.type), title: text(record.title), date: text(record.date), dueDate: text(record.dueDate), eventDate: text(record.eventDate),
    createdAt: text(record.createdAt), updatedAt: text(record.updatedAt), description: text(record.description), notes: text(record.notes),
    status: text(record.status), source: text(record.source), edited: bool(record.edited), tags: strings(record.tags),
    sequenceGroupId: text(record.sequenceGroupId), sequenceGroup: text(record.sequenceGroup),
    linkedRecordIds: strings(record.linkedRecordIds), linkedPartyIds: strings(record.linkedPartyIds),
    attachments: list(record.attachments).map(attachmentMetadata),
  };
}

function mapIncident(record) {
  return { ...baseRecord(record), isMilestone: bool(record.isMilestone), evidenceStatus: text(record.evidenceStatus), linkedEvidenceIds: strings(record.linkedEvidenceIds), linkedIncidentRefs: list(record.linkedIncidentRefs).filter((item) => item && typeof item === "object").map((item) => ({ incidentId: text(item.incidentId), type: text(item.type) })) };
}

function mapEvidence(record) {
  const physical = record.availability?.physical || {}; const digital = record.availability?.digital || {};
  return {
    ...baseRecord(record), capturedAt: text(record.capturedAt), isMilestone: bool(record.isMilestone), sourceType: text(record.sourceType),
    importance: text(record.importance), relevance: text(record.relevance), usedIn: strings(record.usedIn), reviewNotes: text(record.reviewNotes),
    evidenceRole: text(record.evidenceRole), evidenceType: text(record.evidenceType), functionSummary: text(record.functionSummary), linkedIncidentIds: strings(record.linkedIncidentIds),
    availability: { physical: { hasOriginal: bool(physical.hasOriginal), location: text(physical.location), notes: text(physical.notes) }, digital: { hasDigital: bool(digital.hasDigital), files: list(digital.files).map(attachmentMetadata) } },
  };
}

function mapDocument(record) {
  return { id: text(record.id), title: text(record.title), category: text(record.category), documentDate: text(record.documentDate), source: text(record.source), summary: text(record.summary), textContent: text(record.textContent), attachments: list(record.attachments).map(attachmentMetadata), linkedRecordIds: strings(record.linkedRecordIds), linkedPartyIds: strings(record.linkedPartyIds), sequenceGroupId: text(record.sequenceGroupId), sequenceGroup: text(record.sequenceGroup), basedOnEvidenceIds: strings(record.basedOnEvidenceIds), edited: bool(record.edited), createdAt: text(record.createdAt), updatedAt: text(record.updatedAt) };
}

function mapLedger(record) {
  return { id: text(record.id), sequenceGroupId: text(record.sequenceGroupId), sequenceGroup: text(record.sequenceGroup), category: text(record.category), subType: text(record.subType), label: text(record.label), period: text(record.period), expectedAmount: record.expectedAmount ?? null, paidAmount: record.paidAmount ?? null, differenceAmount: record.differenceAmount ?? null, currency: text(record.currency), dueDate: text(record.dueDate), paymentDate: text(record.paymentDate), status: text(record.status), method: text(record.method), reference: text(record.reference), proofType: text(record.proofType), proofStatus: text(record.proofStatus), counterparty: text(record.counterparty), notes: text(record.notes), batchLabel: text(record.batchLabel), linkedRecordIds: strings(record.linkedRecordIds), linkedPartyIds: strings(record.linkedPartyIds), edited: bool(record.edited), createdAt: text(record.createdAt), updatedAt: text(record.updatedAt) };
}

function mapStrategy(record) {
  return { ...baseRecord(record), strategySchemaVersion: record.strategySchemaVersion ?? null, strategyType: text(record.strategyType), objective: text(record.objective), rationale: text(record.rationale), desiredOutcome: text(record.desiredOutcome), priority: text(record.priority), reviewDate: text(record.reviewDate), decisionStatus: text(record.decisionStatus), ownerPartyId: text(record.ownerPartyId), assumptions: strings(record.assumptions), risks: strings(record.risks), nextSteps: strings(record.nextSteps) };
}

function mapWatch(record) {
  return { ...baseRecord(record), category: text(record.category), priority: text(record.priority), reviewDate: text(record.reviewDate), watchFor: text(record.watchFor), rationale: text(record.rationale), triggerConditions: strings(record.triggerConditions), latestObservation: text(record.latestObservation), nextCheck: text(record.nextCheck), outcome: text(record.outcome), observations: list(record.observations).filter((item) => item && typeof item === "object").map((item) => ({ id: text(item.id), date: text(item.date), text: text(item.text), createdAt: text(item.createdAt) })) };
}

function mapIssue(record = {}) {
  return { id: text(record.id), reference: text(record.reference), name: text(record.name), description: text(record.description), purpose: text(record.purpose), status: text(record.status), priority: text(record.priority), ownerPartyId: text(record.ownerPartyId), reviewDate: text(record.reviewDate), currentPosition: text(record.currentPosition), createdAt: text(record.createdAt), updatedAt: text(record.updatedAt) };
}

function mapParty(party = {}) {
  return { id: text(party.id), displayName: text(party.displayName || party.name), legalName: text(party.legalName), aliases: strings(party.aliases), entityType: text(party.entityType), roles: strings(party.roles), organisationName: text(party.organisationName), jobTitle: text(party.jobTitle), department: text(party.department), relationshipToCase: text(party.relationshipToCase), contact: party.contact && typeof party.contact === "object" ? { email: text(party.contact.email), phone: text(party.contact.phone), website: text(party.contact.website), preferredMethod: text(party.contact.preferredMethod), notes: text(party.contact.notes) } : null, address: party.address && typeof party.address === "object" ? { line1: text(party.address.line1), line2: text(party.address.line2), city: text(party.address.city), region: text(party.address.region), postalCode: text(party.address.postalCode), country: text(party.address.country) } : null, status: text(party.status), tags: strings(party.tags), notes: text(party.notes), confidentiality: text(party.confidentiality), edited: bool(party.edited), createdAt: text(party.createdAt), updatedAt: text(party.updatedAt) };
}

function mapActionSummary(summary = {}) {
  projectNextActionTexts(summary.nextActions); // Reject unsupported objects explicitly; keep the projection allowlist.
  return { currentFocus: text(summary.currentFocus), nextActions: list(summary.nextActions).map((item) => typeof item === "string" ? item : item && typeof item === "object" ? { id: text(item.id), text: text(item.text), completed: bool(item.completed), completedAt: text(item.completedAt) } : "").filter(Boolean), importantReminders: strings(summary.importantReminders), strategyFocus: strings(summary.strategyFocus), criticalDeadlines: strings(summary.criticalDeadlines), updatedAt: text(summary.updatedAt) };
}

function dateFor(record, recordType) {
  const choices = recordType === "incident" ? [[record.eventDate, "asserted_event_date"], [record.date, "record_date"]]
    : recordType === "evidence" ? [[record.eventDate, "asserted_event_date"], [record.date, "record_date"], [record.capturedAt, "captured_date"]]
      : recordType === "document" ? [[record.documentDate, "document_date"]]
        : recordType === "ledger" ? [[record.paymentDate, "payment_date"], [record.dueDate, "due_date"], [record.period, "period"]]
          : recordType === "task" ? [[record.dueDate, "due_date"], [record.eventDate, "asserted_event_date"], [record.date, "record_date"]]
            : [[record.eventDate, "asserted_event_date"], [record.date, "record_date"]];
  const selected = choices.find(([value]) => getStrictCalendarDate(value));
  if (selected) return { date: selected[0], dateBasis: selected[1] };
  if (text(record.createdAt)) return { date: "", dateBasis: "undated_created_at_available", createdAt: text(record.createdAt) };
  return { date: "", dateBasis: "undated" };
}

function buildChronology(canonical) {
  const sources = [["incidents", "incident"], ["evidence", "evidence"], ["documents", "document"], ["ledger", "ledger"], ["tasks", "task"], ["strategy", "strategy"], ["watchItems", "watch"]];
  return sources.flatMap(([collection, recordType]) => canonical[collection].map((record) => ({ id: record.id, recordType, title: record.title || record.label || "", ...dateFor(record, recordType) }))).sort((a, b) => (a.date || "9999-99-99").localeCompare(b.date || "9999-99-99") || a.recordType.localeCompare(b.recordType) || a.id.localeCompare(b.id));
}

function buildRelationships(caseItem, canonical) {
  const rawReferences = []; const resolvedReferences = []; const unresolvedReferences = [];
  const add = (sourceType, sourceId, field, targetId, targetType = "record") => {
    if (!targetId) return;
    const raw = { sourceType, sourceId, field, targetId, targetType }; rawReferences.push(raw);
    const target = targetType === "issue" ? canonical.issues.find((item) => item.id === targetId)
      : targetType === "party" ? canonical.parties.find((item) => item.id === targetId)
        : targetType === "incident" ? canonical.incidents.find((item) => item.id === targetId)
          : targetType === "evidence" ? canonical.evidence.find((item) => item.id === targetId) : resolveRecordById(caseItem, targetId);
    if (!target) { unresolvedReferences.push(raw); return; }
    resolvedReferences.push({ ...raw, resolved: { id: target.id, recordType: target.recordType || targetType, title: text(target.title || target.displayName || target.name || target.label) } });
  };
  const mapped = [["incidents", "incident"], ["evidence", "evidence"], ["documents", "document"], ["ledger", "ledger"], ["tasks", "task"], ["strategy", "strategy"], ["watchItems", "watch"]];
  mapped.forEach(([collection, sourceType]) => canonical[collection].forEach((record) => {
    strings(record.linkedRecordIds).forEach((id) => add(sourceType, record.id, "linkedRecordIds", id)); strings(record.linkedPartyIds).forEach((id) => add(sourceType, record.id, "linkedPartyIds", id, "party"));
    if (record.sequenceGroupId) add(sourceType, record.id, "sequenceGroupId", record.sequenceGroupId, "issue");
    strings(record.linkedEvidenceIds).forEach((id) => add(sourceType, record.id, "linkedEvidenceIds", id, "evidence")); strings(record.linkedIncidentIds).forEach((id) => add(sourceType, record.id, "linkedIncidentIds", id, "incident")); strings(record.basedOnEvidenceIds).forEach((id) => add(sourceType, record.id, "basedOnEvidenceIds", id, "evidence"));
    if (record.ownerPartyId) add(sourceType, record.id, "ownerPartyId", record.ownerPartyId, "party"); list(record.linkedIncidentRefs).forEach((ref) => add(sourceType, record.id, `linkedIncidentRefs.${text(ref.type)}`, text(ref.incidentId), "incident"));
  }));
  canonical.issues.forEach((issue) => { if (issue.ownerPartyId) add("issue", issue.id, "ownerPartyId", issue.ownerPartyId, "party"); });
  return { rawReferences, resolvedReferences, unresolvedReferences };
}

function ledgerTotalsByCurrency(ledger) {
  const totals = new Map();
  ledger.forEach((entry) => {
    const currency = entry.currency || "UNSPECIFIED"; const item = totals.get(currency) || { currency, entryCount: 0, expectedTotal: 0, paidTotal: 0, differenceTotal: 0, invalidNumericEntryIds: [] };
    item.entryCount += 1;
    ["expectedAmount", "paidAmount", "differenceAmount"].forEach((field) => { if (typeof entry[field] === "number" && Number.isFinite(entry[field])) item[`${field.replace("Amount", "")}Total`] += entry[field]; else if (entry[field] != null) item.invalidNumericEntryIds.push(entry.id); });
    totals.set(currency, item);
  });
  return [...totals.values()].map((item) => ({ ...item, invalidNumericEntryIds: [...new Set(item.invalidNumericEntryIds)] })).sort((a, b) => a.currency.localeCompare(b.currency));
}

export function buildAiWorkspaceCaseProjection(caseItem, options = {}) {
  if (!caseItem?.id) throw new Error("caseItem.id is required for an AI Workspace projection");
  const source = normalizeCaseIssues(caseItem).caseData;
  const canonical = {
    issues: buildIssueIndex(source).map((index) => mapIssue(source.issues.find((item) => item.id === index.id))),
    parties: list(source.parties).map(mapParty),
    incidents: list(source.incidents).map(mapIncident), evidence: list(source.evidence).map(mapEvidence), documents: list(source.documents).map(mapDocument), ledger: list(source.ledger).map(mapLedger), tasks: list(source.tasks).map(baseRecord), strategy: list(source.strategy).map(mapStrategy), watchItems: list(source.watchItems).map(mapWatch), actionSummary: mapActionSummary(source.actionSummary),
  };
  Object.values(canonical).forEach((records) => { if (Array.isArray(records)) records.forEach((record) => { record.authority = "canonical_stored_case_data"; }); });
  const sourceCounts = Object.fromEntries(COLLECTIONS.map((collection) => [collection, list(source[collection]).length]));
  const exportedCounts = Object.fromEntries(COLLECTIONS.map((collection) => [collection, list(canonical[collection]).length]));
  return {
    contractVersion: AI_WORKSPACE_CASE_PROJECTION_VERSION, app: "proveit", exportType: "CASE_REASONING_EXPORT", exportedAt: options.exportedAt || new Date().toISOString(), importable: false, includesBinaryData: false,
    authority: { canonical: "authoritative stored ProveIt case data", derived: "deterministic read-only calculations", context: "non-authoritative user-entered or generated summaries" },
    case: { id: text(source.id), name: text(source.name), category: text(source.category), status: text(source.status), tags: strings(source.tags), createdAt: text(source.createdAt), updatedAt: text(source.updatedAt), authority: "canonical_stored_case_data" },
    canonical,
    derived: { sourceCounts, exportedCounts, countParity: COLLECTIONS.every((collection) => sourceCounts[collection] === exportedCounts[collection]), relationships: buildRelationships(source, canonical), chronology: buildChronology(canonical), ledgerTotalsByCurrency: ledgerTotalsByCurrency(canonical.ledger) },
    context: { userEntered: { caseDescription: text(source.description), caseNotes: text(source.notes) }, generatedOrHeuristic: { summaries: [], diagnostics: [] } },
    exclusions: { prohibitedDataCategories: ["case_credentials_and_locks", "binary_attachment_payloads", "audit_history", "backup_or_import_state", "cache_or_storage_implementation_details"] },
  };
}
