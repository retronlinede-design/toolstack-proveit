import { getCaseRevision, INITIAL_CASE_REVISION } from "../domain/caseRevision.js";
import { normalizeStoredCase } from "../domain/caseNormalization.js";
import { buildAiWorkspaceCaseProjection } from "./aiWorkspaceProjection.js";

export const STRATEGY_CONTEXT_CONTRACT = "proveit-strategy-context";
export const STRATEGY_CONTEXT_VERSION = "1.0";

const RECORD_COLLECTIONS = ["incidents", "evidence", "documents", "ledger", "tasks", "watchItems"];
const text = (value) => typeof value === "string" ? value : "";
const strings = (value) => Array.isArray(value) ? value.filter((item) => typeof item === "string" && item) : [];

function mapGoal(goal = {}) {
  return { id: text(goal.id), title: text(goal.title), description: text(goal.description), successCriteria: strings(goal.successCriteria), status: text(goal.status), priority: text(goal.priority), issueIds: strings(goal.issueIds), reviewDate: text(goal.reviewDate), createdAt: text(goal.createdAt), updatedAt: text(goal.updatedAt), authority: "canonical_stored_case_data" };
}

function idsLinkedFromStrategy(strategy = {}) { return new Set([...strings(strategy.linkedRecordIds), ...strings(strategy.linkedEvidenceIds), ...strings(strategy.linkedIncidentIds), ...strings(strategy.basedOnEvidenceIds)]); }

function selectRelatedContext(source, projection, strategies, relatedIssueIds) {
  const directIds = new Set(strategies.flatMap((strategy) => [...idsLinkedFromStrategy(strategy)]));
  const relatedRecordIds = new Set(directIds);
  const sourceByCollection = Object.fromEntries(RECORD_COLLECTIONS.map((collection) => [collection, Array.isArray(source[collection]) ? source[collection] : []]));
  RECORD_COLLECTIONS.forEach((collection) => sourceByCollection[collection].forEach((record) => { if (relatedIssueIds.has(record?.sequenceGroupId)) relatedRecordIds.add(record.id); }));
  const records = Object.fromEntries(RECORD_COLLECTIONS.map((collection) => [collection, (projection.canonical[collection] || []).filter((record) => relatedRecordIds.has(record.id))]));
  const chronologyIds = new Set([...strategies.map((strategy) => strategy.id), ...relatedRecordIds]);
  const partyIds = new Set(strategies.flatMap((strategy) => [strategy.ownerPartyId, ...strings(strategy.linkedPartyIds)]).filter(Boolean));
  return {
    records,
    parties: (projection.canonical.parties || []).filter((party) => partyIds.has(party.id)),
    chronology: projection.derived.chronology.filter((entry) => chronologyIds.has(entry.id)),
    deterministicDiagnostics: {
      unresolvedReferences: projection.derived.relationships.unresolvedReferences.filter((reference) => chronologyIds.has(reference.sourceId)),
      undatedChronologyEntries: projection.derived.chronology.filter((entry) => chronologyIds.has(entry.id) && !entry.date),
    },
  };
}

export function buildStrategyContextPayload(caseItem, focusedGoalId, options = {}) {
  if (!caseItem?.id) throw new Error("caseItem.id is required for a Strategy Context export");
  if (!focusedGoalId) throw new Error("A focused Goal is required for a Strategy Context export");
  const source = normalizeStoredCase(caseItem);
  const focusedGoal = (Array.isArray(source.goals) ? source.goals : []).find((goal) => goal.id === focusedGoalId);
  if (!focusedGoal) throw new Error("The focused Goal is not available in this case");

  const exportedAt = options.exportedAt || new Date().toISOString();
  const projection = buildAiWorkspaceCaseProjection(source, { exportedAt });
  const strategyIds = new Set((Array.isArray(source.strategy) ? source.strategy : []).filter((strategy) => Array.isArray(strategy.goalIds) && strategy.goalIds.includes(focusedGoal.id)).map((strategy) => strategy.id));
  const linkedStrategies = projection.canonical.strategy.filter((strategy) => strategyIds.has(strategy.id));
  const sourceStrategies = (Array.isArray(source.strategy) ? source.strategy : []).filter((strategy) => strategyIds.has(strategy.id));
  const relatedIssueIds = new Set([...strings(focusedGoal.issueIds), ...sourceStrategies.map((strategy) => text(strategy.sequenceGroupId)).filter(Boolean)]);
  const relatedIssues = projection.canonical.issues.filter((issue) => relatedIssueIds.has(issue.id));

  return {
    contract: STRATEGY_CONTEXT_CONTRACT, contractVersion: STRATEGY_CONTEXT_VERSION, app: "proveit", exportType: "STRATEGY_CONTEXT", exportedAt, importable: false, includesBinaryData: false,
    baseRevision: getCaseRevision(source) || INITIAL_CASE_REVISION,
    authority: { canonical: "authoritative stored ProveIt case data", derived: "deterministic read-only context derived from the selected Goal", instructions: "advisory guidance for external strategic analysis" },
    case: projection.case, focusedGoal: mapGoal(focusedGoal), linkedStrategies, relatedIssues,
    relevantContext: selectRelatedContext(source, projection, sourceStrategies, relatedIssueIds),
    instructions: { purpose: "Strategic analysis of the focused Goal and its linked Strategy records.", systemOfRecord: "ProveIt remains the authoritative system of record.", recommendations: "Treat recommendations as proposals for user review.", futureUpdates: "Future machine-readable updates must use a proveit-strategy-delta contract, not a modified case snapshot." },
    exclusions: projection.exclusions,
  };
}

function safeFilenamePart(value, fallback) { const normalized = text(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""); return normalized || fallback; }
export function getStrategyContextFilename(caseItem, focusedGoal) { return `proveit-strategy-context-${safeFilenamePart(caseItem?.name || caseItem?.id, "case")}-${safeFilenamePart(focusedGoal?.id || focusedGoal?.title, "goal")}.json`; }
export function serializeStrategyContext(payload) { return JSON.stringify(payload, null, 2); }
