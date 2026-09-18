import { getCaseRevision, INITIAL_CASE_REVISION } from "../domain/caseRevision.js";

export const GOALS_STRATEGY_EXPORT_CONTRACT = "proveit-goals-strategy-export";
export const GOALS_STRATEGY_EXPORT_VERSION = "1.0";

const text = (value) => typeof value === "string" ? value : "";
const strings = (value) => Array.isArray(value) ? value.filter((item) => typeof item === "string" && item) : [];

function mapGoal(goal = {}) {
  return {
    id: text(goal.id), title: text(goal.title), description: text(goal.description),
    successCriteria: strings(goal.successCriteria), status: text(goal.status), priority: text(goal.priority),
    issueIds: strings(goal.issueIds), reviewDate: text(goal.reviewDate),
    createdAt: text(goal.createdAt), updatedAt: text(goal.updatedAt),
  };
}

function mapStrategy(strategy = {}) {
  return {
    id: text(strategy.id), type: text(strategy.type), title: text(strategy.title),
    date: text(strategy.date), eventDate: text(strategy.eventDate),
    description: text(strategy.description), notes: text(strategy.notes), status: text(strategy.status),
    source: text(strategy.source), edited: !!strategy.edited, tags: strings(strategy.tags),
    createdAt: text(strategy.createdAt), updatedAt: text(strategy.updatedAt),
    sequenceGroupId: text(strategy.sequenceGroupId), sequenceGroup: text(strategy.sequenceGroup),
    goalIds: strings(strategy.goalIds), linkedRecordIds: strings(strategy.linkedRecordIds),
    linkedPartyIds: strings(strategy.linkedPartyIds), linkedIncidentIds: strings(strategy.linkedIncidentIds),
    linkedEvidenceIds: strings(strategy.linkedEvidenceIds), basedOnEvidenceIds: strings(strategy.basedOnEvidenceIds),
    strategySchemaVersion: Number.isInteger(strategy.strategySchemaVersion) ? strategy.strategySchemaVersion : null,
    strategyType: text(strategy.strategyType), objective: text(strategy.objective), rationale: text(strategy.rationale),
    desiredOutcome: text(strategy.desiredOutcome), priority: text(strategy.priority), reviewDate: text(strategy.reviewDate),
    decisionStatus: text(strategy.decisionStatus), ownerPartyId: text(strategy.ownerPartyId),
    assumptions: strings(strategy.assumptions), risks: strings(strategy.risks), nextSteps: strings(strategy.nextSteps),
  };
}

function safeFilenamePart(value, fallback) {
  const normalized = text(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return normalized || fallback;
}

export function buildGoalsStrategyExport(caseItem, options = {}) {
  if (!caseItem?.id) throw new Error("caseItem.id is required for a Goals & Strategy export");
  return {
    contract: GOALS_STRATEGY_EXPORT_CONTRACT,
    version: GOALS_STRATEGY_EXPORT_VERSION,
    app: "proveit",
    exportType: "GOALS_STRATEGY_EXPORT",
    exportedAt: options.exportedAt || new Date().toISOString(),
    importable: false,
    includesBinaryData: false,
    baseRevision: getCaseRevision(caseItem) || INITIAL_CASE_REVISION,
    case: { id: text(caseItem.id), name: text(caseItem.name), status: text(caseItem.status) },
    goals: Array.isArray(caseItem.goals) ? caseItem.goals.map(mapGoal) : [],
    strategy: Array.isArray(caseItem.strategy) ? caseItem.strategy.map(mapStrategy) : [],
  };
}

export function getGoalsStrategyExportFilename(caseItem) {
  return `${safeFilenamePart(caseItem?.name || caseItem?.id, "case")}-goals-strategy.json`;
}
