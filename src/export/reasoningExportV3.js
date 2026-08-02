import { resolveRecordById } from "../domain/linkingResolvers.js";
import { runOperationalIntegrityCheck } from "../diagnostics/operationalIntegrity.js";
import { buildIssueIndex, HUMAN_READABLE_ISSUE_PROMPT, normalizeCaseIssues } from "../domain/issueDomain.js";

export const REASONING_EXPORT_V3 = "reasoning-export-3.0";
export const WATCH_FACTUAL_STATUS = "unconfirmed_monitored_concern";
const CLOSED_WATCH_STATUSES = new Set(["resolved", "archived", "no_longer_relevant"]);
const CLOSED_STRATEGY_STATUSES = new Set(["archived", "completed"]);

const clean = (value) => typeof value === "string" ? value.trim() : "";
const strings = (value) => Array.isArray(value) ? [...new Set(value.map(clean).filter(Boolean))] : [];
const strictDate = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return "";
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day ? value : "";
};
const dayNumber = (value) => {
  const valid = strictDate(value);
  if (!valid) return null;
  const [year, month, day] = valid.split("-").map(Number);
  return Date.UTC(year, month - 1, day) / 86400000;
};

export function classifyReasoningReviewDate(value, today) {
  const review = dayNumber(value); const reference = dayNumber(today);
  if (review == null || reference == null) return "none";
  const difference = review - reference;
  if (difference < 0) return "overdue";
  if (difference <= 14) return "due_soon";
  return "scheduled";
}

function recordType(record) {
  const type = clean(record?.recordType || record?.type).toLowerCase();
  if (type === "incidents") return "incident";
  if (type === "evidence") return "evidence";
  if (type === "watchitems" || type === "watch") return "watch";
  if (type === "tasks") return "task";
  return type || "record";
}

function compactLink(caseItem, id) {
  const target = resolveRecordById(caseItem, id);
  if (!target) return null;
  return { id: target.id, recordType: recordType(target), title: clean(target.title), eventDate: strictDate(target.eventDate || target.date || target.documentDate || target.paymentDate) };
}

function resolveLinks(caseItem, ids) {
  return strings(ids).map((id) => compactLink(caseItem, id)).filter(Boolean).sort((a, b) => a.recordType.localeCompare(b.recordType) || a.id.localeCompare(b.id));
}

function compactDiagnostics(issues, recordId) {
  const seen = new Set();
  return issues.filter((issue) => issue.recordId === recordId && issue.code).map((issue) => ({ code: issue.code, severity: issue.severity || "info", message: clean(issue.message) })).filter((issue) => {
    const key = `${issue.code}\u0000${issue.message}`;
    if (seen.has(key)) return false;
    seen.add(key); return true;
  }).sort((a, b) => a.code.localeCompare(b.code) || a.message.localeCompare(b.message));
}

function withBrokenReferences(diagnostics, missingIds) {
  const missing = [...new Set(missingIds.filter(Boolean))].sort();
  if (!missing.length) return diagnostics;
  return [...diagnostics, { code: "BROKEN_REFERENCE", severity: "warning", message: `Missing referenced ID(s): ${missing.join(", ")}.` }].sort((a, b) => a.code.localeCompare(b.code) || a.message.localeCompare(b.message));
}

function partyReference(partiesById, id) {
  const party = partiesById.get(clean(id));
  return party ? { id: party.id, name: clean(party.name || party.displayName || party.label) } : null;
}

function recentObservations(item, limit = 3) {
  return (Array.isArray(item.observations) ? item.observations : []).filter((observation) => clean(observation?.text) && strictDate(observation?.date)).map((observation) => ({
    id: clean(observation.id), date: observation.date, text: clean(observation.text), createdAt: clean(observation.createdAt),
  })).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id)).slice(0, limit).map(({ id, date, text }) => ({ ...(id ? { id } : {}), date, text }));
}

function strategyProjection(strategy, context) {
  const objective = clean(strategy.objective) || clean(strategy.description) || clean(strategy.title);
  const description = clean(strategy.description);
  const linkIds = [...strings(strategy.linkedRecordIds), ...strings(strategy.linkedIncidentIds), ...strings(strategy.linkedEvidenceIds)];
  const linkedRecords = resolveLinks(context.caseItem, linkIds);
  const missingIds = linkIds.filter((id) => !linkedRecords.some((record) => record.id === id));
  if (clean(strategy.ownerPartyId) && !context.partiesById.has(clean(strategy.ownerPartyId))) missingIds.push(clean(strategy.ownerPartyId));
  return {
    id: strategy.id, recordType: "strategy", factualStatus: "planning_or_analysis", title: clean(strategy.title), status: clean(strategy.status) || "open",
    strategyType: clean(strategy.strategyType), priority: clean(strategy.priority), decisionStatus: clean(strategy.decisionStatus), objective,
    ...(description && description !== objective ? { description } : {}), ...(clean(strategy.notes) ? { notes: clean(strategy.notes) } : {}),
    rationale: clean(strategy.rationale), desiredOutcome: clean(strategy.desiredOutcome), assumptions: strings(strategy.assumptions), risks: strings(strategy.risks), nextSteps: strings(strategy.nextSteps),
    owner: partyReference(context.partiesById, strategy.ownerPartyId), reviewDate: strictDate(strategy.reviewDate), reviewState: classifyReasoningReviewDate(strategy.reviewDate, context.today),
    eventDate: strictDate(strategy.eventDate || strategy.date), sequenceGroup: clean(strategy.sequenceGroup), tags: strings(strategy.tags),
    linkedRecords,
    diagnostics: withBrokenReferences(compactDiagnostics(context.issues, strategy.id), missingIds),
  };
}

function watchProjection(item, context) {
  const observations = recentObservations(item, context.observationLimit);
  const latestObservation = clean(item.latestObservation);
  const linkIds = strings(item.linkedRecordIds); const partyIds = strings(item.linkedPartyIds);
  const linkedRecords = resolveLinks(context.caseItem, linkIds);
  const missingIds = [...linkIds.filter((id) => !linkedRecords.some((record) => record.id === id)), ...partyIds.filter((id) => !context.partiesById.has(id))];
  return {
    id: item.id, recordType: "watch", factualStatus: WATCH_FACTUAL_STATUS, title: clean(item.title), status: clean(item.status) || "watching", category: clean(item.category), priority: clean(item.priority),
    watchFor: clean(item.watchFor), rationale: clean(item.rationale), triggerConditions: strings(item.triggerConditions),
    latestObservation: observations[0]?.text === latestObservation ? "" : latestObservation, nextCheck: clean(item.nextCheck), outcome: clean(item.outcome),
    reviewDate: strictDate(item.reviewDate), reviewState: classifyReasoningReviewDate(item.reviewDate, context.today), eventDate: strictDate(item.eventDate || item.date),
    sequenceGroup: clean(item.sequenceGroup), tags: strings(item.tags), relatedParties: partyIds.map((id) => partyReference(context.partiesById, id)).filter(Boolean).sort((a, b) => a.id.localeCompare(b.id)),
    linkedRecords, recentObservations: observations, diagnostics: withBrokenReferences(compactDiagnostics(context.issues, item.id), missingIds),
  };
}

function buildThreads(caseItem, strategies, watchItems) {
  const supporting = [
    ...(caseItem.incidents || []).map((record) => ({ record, recordType: "incident" })), ...(caseItem.evidence || []).map((record) => ({ record, recordType: "evidence" })),
    ...(caseItem.documents || []).map((record) => ({ record, recordType: "document" })), ...(caseItem.ledger || []).map((record) => ({ record, recordType: "ledger" })),
  ];
  const names = [...new Set([...strategies, ...watchItems, ...supporting.map(({ record }) => record)].map((record) => clean(record.sequenceGroup)).filter(Boolean))].sort();
  return names.map((sequenceGroup) => ({
    sequenceGroup,
    strategyIds: strategies.filter((item) => item.sequenceGroup === sequenceGroup).map((item) => item.id).sort(),
    watchItemIds: watchItems.filter((item) => item.sequenceGroup === sequenceGroup).map((item) => item.id).sort(),
    supportingRecords: supporting.filter(({ record }) => clean(record.sequenceGroup) === sequenceGroup).map(({ record, recordType: type }) => ({ id: record.id, recordType: type, title: clean(record.title || record.label) })).sort((a, b) => a.recordType.localeCompare(b.recordType) || a.id.localeCompare(b.id)),
    note: "Common sequence-group membership provides context, not evidentiary proof.",
  }));
}

export function buildCaseReasoningExportV3Payload(caseItem, options = {}) {
  if (!caseItem) throw new Error("caseItem is required for reasoning-export-3.0");
  caseItem = normalizeCaseIssues(caseItem).caseData;
  const exportedAt = options.exportedAt || new Date().toISOString();
  const today = strictDate(options.today) || strictDate(exportedAt.slice(0, 10));
  const integrity = runOperationalIntegrityCheck(caseItem, { now: exportedAt, today });
  const issues = integrity.openOperationalLoops.issues || [];
  const partiesById = new Map((caseItem.parties || []).filter((party) => party?.id).map((party) => [party.id, party]));
  const activeStrategies = (caseItem.strategy || []).filter((item) => options.includeArchivedStrategies || !CLOSED_STRATEGY_STATUSES.has(clean(item.status).toLowerCase())).slice().sort((a, b) => clean(a.eventDate || a.date).localeCompare(clean(b.eventDate || b.date)) || clean(a.id).localeCompare(clean(b.id)));
  const activeWatch = (caseItem.watchItems || []).filter((item) => options.includeClosedMonitoring || !CLOSED_WATCH_STATUSES.has(clean(item.status).toLowerCase())).slice().sort((a, b) => clean(a.eventDate || a.date).localeCompare(clean(b.eventDate || b.date)) || clean(a.id).localeCompare(clean(b.id)));
  const context = { caseItem, partiesById, issues, today, observationLimit: 3 };
  const strategies = activeStrategies.map((item) => strategyProjection(item, context));
  const watchItems = activeWatch.map((item) => watchProjection(item, context));
  const stats = integrity.openOperationalLoops.stats || {};
  const diagnosticSummary = Object.fromEntries(["overdueStrategyReviews", "unsupportedStrategies", "highPriorityStrategiesWithoutNextSteps", "overdueWatchReviews", "staleWatchItems", "escalatedWatchItemsWithoutOutcome", "watchItemsRequiringEscalationReview"].map((key) => [key, Number(stats[key] || 0)]));
  return {
    app: "proveit", exportType: "CASE_REASONING_EXPORT", contractVersion: REASONING_EXPORT_V3, exportedAt, importable: false, includesBinaryData: false, instructions: HUMAN_READABLE_ISSUE_PROMPT,
    factualStatusConventions: { incident: "recorded_event_or_allegation", evidence: "supporting_material", strategy: "planning_or_analysis", watch: WATCH_FACTUAL_STATUS },
    case: {
      id: caseItem.id, title: clean(caseItem.name || caseItem.title), caseType: clean(caseItem.category || caseItem.caseType), status: clean(caseItem.status), createdDate: clean(caseItem.createdAt), updatedDate: clean(caseItem.updatedAt),
      parties: [...partiesById.values()].map((party) => ({ id: party.id, name: clean(party.name || party.displayName || party.label) })).sort((a, b) => a.id.localeCompare(b.id)),
      currentFocus: clean(caseItem.actionSummary?.currentFocus), actionSummary: { nextActions: strings(caseItem.actionSummary?.nextActions), importantReminders: strings(caseItem.actionSummary?.importantReminders), strategyFocus: strings(caseItem.actionSummary?.strategyFocus), criticalDeadlines: strings(caseItem.actionSummary?.criticalDeadlines) },
      counts: { incidents: (caseItem.incidents || []).length, evidence: (caseItem.evidence || []).length, documents: (caseItem.documents || []).length, ledger: (caseItem.ledger || []).length, strategies: (caseItem.strategy || []).length, watchItems: (caseItem.watchItems || []).length },
      omitted: { closedOrArchivedStrategies: (caseItem.strategy || []).length - activeStrategies.length, closedMonitoringItems: (caseItem.watchItems || []).length - activeWatch.length },
      issues: buildIssueIndex(caseItem), strategies, watchItems, sequenceGroups: buildThreads(caseItem, strategies, watchItems), diagnosticSummary,
    },
  };
}
