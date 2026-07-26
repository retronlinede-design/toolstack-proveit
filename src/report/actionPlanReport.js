import { analyzeCaseDiagnostics } from "../diagnostics/caseDiagnostics.js";
import {
  getActionText,
  getActiveNextActions,
  normalizeActionSummary,
} from "../components/caseDetail/actionSummaryHelpers.js";
import {
  buildStrategyReportItem,
  getCurrentWatchItems,
} from "./reportBuilder.js";

const CLOSED_STATUSES = new Set(["done", "closed", "archived"]);

function normaliseGroupName(value) {
  return typeof value === "string" ? value.trim().toLocaleLowerCase() : "";
}

function belongsToGroup(item, groupName) {
  const requestedGroup = normaliseGroupName(groupName);
  return Boolean(requestedGroup) && normaliseGroupName(item?.sequenceGroup) === requestedGroup;
}

function recordIsInScope(item, scopeType, groupName) {
  return scopeType !== "sequenceGroup" || belongsToGroup(item, groupName);
}

function diagnosticIsInScope(item, scopeType, scopedRecordIds) {
  return scopeType !== "sequenceGroup" || scopedRecordIds.has(item?.id);
}

function scopedStructuredSummaryItems(items, scopeType, groupName) {
  if (scopeType !== "sequenceGroup") return items;
  return (Array.isArray(items) ? items : [])
    .filter((item) => typeof item === "object" && belongsToGroup(item, groupName));
}

function getScopedRecordIds(caseData, scopeType, groupName) {
  if (scopeType !== "sequenceGroup") return new Set();
  const recordIds = new Set();
  for (const collection of ["incidents", "evidence", "documents", "strategy", "watchItems"]) {
    for (const record of Array.isArray(caseData?.[collection]) ? caseData[collection] : []) {
      if (record?.id && belongsToGroup(record, groupName)) recordIds.add(record.id);
    }
  }
  return recordIds;
}

export function buildActionPlanReport(caseData = {}, options = {}) {
  const scopeType = options.scope === "sequenceGroup" || options.scopeType === "sequenceGroup"
    ? "sequenceGroup"
    : "case";
  const sequenceGroupName = typeof options.sequenceGroupName === "string"
    ? options.sequenceGroupName.trim()
    : typeof options.sequenceGroup === "string" ? options.sequenceGroup.trim() : "";
  const diagnostics = analyzeCaseDiagnostics(caseData);
  const normalizedActionSummary = normalizeActionSummary(caseData.actionSummary || {});
  const scopedRecordIds = getScopedRecordIds(caseData, scopeType, sequenceGroupName);

  const weakRecords = (diagnostics.integrity?.weaklyLinkedRecords || [])
    .filter((item) => diagnosticIsInScope(item, scopeType, scopedRecordIds));
  const orphanRecords = (diagnostics.integrity?.orphanRecords || [])
    .filter((item) => diagnosticIsInScope(item, scopeType, scopedRecordIds));
  const unsupportedIncidents = (diagnostics.evidenceCoverage?.incidentsNeedingEvidence || [])
    .filter((item) => diagnosticIsInScope(item, scopeType, scopedRecordIds));
  const chronologyGaps = (diagnostics.chronology?.missingDateRecords || [])
    .filter((item) => diagnosticIsInScope(item, scopeType, scopedRecordIds));

  const strategyRecords = (caseData.strategy || [])
    .filter((item) => item?.id && !CLOSED_STATUSES.has(item.status))
    .filter((item) => recordIsInScope(item, scopeType, sequenceGroupName));
  const watchItems = getCurrentWatchItems(caseData)
    .filter((item) => recordIsInScope(item, scopeType, sequenceGroupName));
  const openTasks = (caseData.tasks || [])
    .filter((item) => item?.id && !CLOSED_STATUSES.has(item.status))
    .filter((item) => recordIsInScope(item, scopeType, sequenceGroupName));

  const rawSummary = caseData.actionSummary || {};
  const nextActions = scopeType === "sequenceGroup"
    ? scopedStructuredSummaryItems(rawSummary.nextActions, scopeType, sequenceGroupName)
      .filter((item) => item.completed !== true)
      .map(getActionText)
      .filter(Boolean)
    : getActiveNextActions(normalizedActionSummary.nextActions).map(getActionText);
  const importantReminders = scopeType === "sequenceGroup"
    ? scopedStructuredSummaryItems(rawSummary.importantReminders, scopeType, sequenceGroupName).map(getActionText).filter(Boolean)
    : normalizedActionSummary.importantReminders;
  const strategyFocus = scopeType === "sequenceGroup"
    ? scopedStructuredSummaryItems(rawSummary.strategyFocus, scopeType, sequenceGroupName).map(getActionText).filter(Boolean)
    : normalizedActionSummary.strategyFocus;
  const criticalDeadlines = scopeType === "sequenceGroup"
    ? scopedStructuredSummaryItems(rawSummary.criticalDeadlines, scopeType, sequenceGroupName).map(getActionText).filter(Boolean)
    : normalizedActionSummary.criticalDeadlines;

  const risks = [
    ...unsupportedIncidents.map((item) => ({ id: `unsupported-${item.id}`, label: "Unsupported incident", text: item.title })),
    ...weakRecords.slice(0, 8).map((item) => ({ id: `weak-${item.type}-${item.id}`, label: "Weak link", text: item.title })),
    ...orphanRecords.slice(0, 8).map((item) => ({ id: `orphan-${item.type}-${item.id}`, label: "Unlinked record", text: item.title })),
    ...chronologyGaps.slice(0, 8).map((item) => ({ id: `date-${item.type}-${item.id}`, label: "Chronology gap", text: item.title })),
  ];

  return {
    title: scopeType === "sequenceGroup"
      ? `Action Plan: ${sequenceGroupName || "Unselected sequenceGroup"}`
      : "Action Plan: Whole Case",
    sourceCaseId: caseData.id || "",
    generatedAt: options.generatedAt || new Date().toISOString(),
    scopeLabel: scopeType === "sequenceGroup" ? `sequenceGroup: ${sequenceGroupName || "-"}` : "Whole case",
    scopeType,
    sequenceGroupName,
    isEmptyScope: scopeType === "sequenceGroup" && scopedRecordIds.size === 0,
    caseOverview: {
      name: caseData.name || "",
      category: caseData.category || "",
      status: caseData.status || "",
    },
    currentFocus: scopeType === "case" ? normalizedActionSummary.currentFocus || "" : "",
    nextActions,
    importantReminders,
    strategyFocus,
    criticalDeadlines,
    openStrategyRecords: strategyRecords.map((item) => buildStrategyReportItem(caseData, item)),
    watchItems,
    openTasks,
    risks,
    recommendedFixes: [
      ...(unsupportedIncidents.length > 0 ? ["Link evidence to unsupported incidents before escalation."] : []),
      ...(weakRecords.length > 0 || orphanRecords.length > 0 ? ["Review weak or unlinked records and connect them to the relevant incidents, evidence, documents, or ledger entries."] : []),
      ...(chronologyGaps.length > 0 ? ["Add missing dates or ordering information to strengthen chronology."] : []),
      ...(nextActions.length === 0 ? ["Add explicit next actions to the case action summary."] : []),
    ],
    counts: {
      nextActions: nextActions.length,
      reminders: importantReminders.length,
      deadlines: criticalDeadlines.length,
      openStrategy: strategyRecords.length,
      openTasks: openTasks.length,
      risks: risks.length,
    },
  };
}
