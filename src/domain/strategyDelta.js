import { getCaseRevision, INITIAL_CASE_REVISION } from "./caseRevision.js";
import { generateId, normalizeRecord } from "./caseDomain.js";

export const STRATEGY_DELTA_CONTRACT = "proveit-strategy-delta";
export const STRATEGY_DELTA_VERSION = "1.0";

const UPDATE_TYPES = {
  "update-strategy-rationale": "rationale",
  "update-strategy-desired-outcome": "desiredOutcome",
  "update-strategy-objective": "objective",
};
const ADD_TYPES = {
  "add-strategy-assumption": "assumptions",
  "add-strategy-risk": "risks",
  "add-strategy-next-step": "nextSteps",
};
const CREATE_FIELDS = ["title", "strategyType", "objective", "rationale", "desiredOutcome", "priority", "reviewDate", "assumptions", "risks", "nextSteps"];
const STRING_LIST_FIELDS = new Set(["assumptions", "risks", "nextSteps"]);
const allowedTopLevelFields = new Set(["contract", "version", "caseId", "baseRevision", "goalId", "proposals"]);

const text = (value) => typeof value === "string" ? value.trim() : "";
const isObject = (value) => !!value && typeof value === "object" && !Array.isArray(value);

function safeTextList(value) {
  const seen = new Set();
  return (Array.isArray(value) ? value : []).reduce((items, item) => {
    const normalized = text(item);
    if (!normalized || seen.has(normalized)) return items;
    seen.add(normalized);
    items.push(normalized);
    return items;
  }, []);
}

function invalid(message) { return { ok: false, reason: message }; }

export function parseStrategyDeltaText(value) {
  try {
    const payload = JSON.parse(value);
    return isObject(payload) ? { ok: true, payload } : invalid("Strategy Delta must be a JSON object.");
  } catch {
    return invalid("Invalid JSON.");
  }
}

function validateCreateStrategy(strategy, label) {
  if (!isObject(strategy)) return invalid(`${label}.strategy must be an object.`);
  const unknown = Object.keys(strategy).filter((field) => !CREATE_FIELDS.includes(field));
  if (unknown.length) return invalid(`${label}.strategy contains unsupported field(s): ${unknown.join(", ")}.`);
  if (!text(strategy.title)) return invalid(`${label}.strategy.title is required.`);
  for (const field of CREATE_FIELDS) {
    if (!Object.hasOwn(strategy, field)) continue;
    if (STRING_LIST_FIELDS.has(field)) {
      if (!Array.isArray(strategy[field]) || strategy[field].some((item) => typeof item !== "string")) return invalid(`${label}.strategy.${field} must be an array of strings.`);
    } else if (typeof strategy[field] !== "string") return invalid(`${label}.strategy.${field} must be a string.`);
  }
  return { ok: true, strategy: Object.fromEntries(CREATE_FIELDS.filter((field) => Object.hasOwn(strategy, field)).map((field) => [field, STRING_LIST_FIELDS.has(field) ? safeTextList(strategy[field]) : text(strategy[field])])) };
}

export function validateStrategyDelta(caseItem, payload) {
  if (!caseItem?.id || !isObject(payload)) return invalid("Strategy Delta must be a JSON object for the current case.");
  const unknownTopLevel = Object.keys(payload).filter((field) => !allowedTopLevelFields.has(field));
  if (unknownTopLevel.length) return invalid(`Strategy Delta contains unsupported top-level field(s): ${unknownTopLevel.join(", ")}.`);
  if (payload.contract !== STRATEGY_DELTA_CONTRACT) return invalid("Unsupported Strategy Delta contract.");
  if (payload.version !== STRATEGY_DELTA_VERSION) return invalid("Unsupported Strategy Delta version.");
  if (text(payload.caseId) !== String(caseItem.id)) return invalid("Strategy Delta caseId does not match the current case.");
  if (!Number.isSafeInteger(payload.baseRevision) || payload.baseRevision < INITIAL_CASE_REVISION) return invalid("Strategy Delta baseRevision must be a supported case revision.");
  const goalId = text(payload.goalId);
  const goal = (Array.isArray(caseItem.goals) ? caseItem.goals : []).find((item) => item.id === goalId);
  if (!goal) return invalid("Strategy Delta goalId does not identify a current Goal.");
  if (!Array.isArray(payload.proposals) || payload.proposals.length === 0) return invalid("Strategy Delta proposals must be a non-empty array.");

  const strategies = Array.isArray(caseItem.strategy) ? caseItem.strategy : [];
  const planned = [];
  const seenUpdates = new Set();
  for (const [index, proposal] of payload.proposals.entries()) {
    const label = `Proposal ${index + 1}`;
    if (!isObject(proposal) || typeof proposal.type !== "string") return invalid(`${label} must contain a supported type.`);
    const type = proposal.type;
    const allowed = type === "create-strategy"
      ? ["type", "strategy", "reason"]
      : (UPDATE_TYPES[type] || ADD_TYPES[type]) ? ["type", "strategyId", "value", "reason"] : [];
    if (!allowed.length) return invalid(`${label} has unsupported proposal type: ${type}.`);
    const unknown = Object.keys(proposal).filter((field) => !allowed.includes(field));
    if (unknown.length) return invalid(`${label} contains unsupported field(s): ${unknown.join(", ")}.`);
    if (Object.hasOwn(proposal, "reason") && typeof proposal.reason !== "string") return invalid(`${label}.reason must be a string.`);
    const reason = text(proposal.reason);

    if (type === "create-strategy") {
      const create = validateCreateStrategy(proposal.strategy, label);
      if (!create.ok) return create;
      planned.push({ index, type, strategy: create.strategy, reason });
      continue;
    }

    const strategyId = text(proposal.strategyId);
    const strategy = strategies.find((item) => item.id === strategyId);
    if (!strategy) return invalid(`${label}.strategyId does not identify a current Strategy.`);
    if (!Array.isArray(strategy.goalIds) || !strategy.goalIds.includes(goalId)) return invalid(`${label}.strategyId is not linked to the referenced Goal.`);
    if (UPDATE_TYPES[type]) {
      const updateKey = `${strategyId}\u0000${type}`;
      if (seenUpdates.has(updateKey)) return invalid(`${label} duplicates an earlier update for the same Strategy field.`);
      seenUpdates.add(updateKey);
    }
    if (typeof proposal.value !== "string") return invalid(`${label}.value must be a string.`);
    const value = text(proposal.value);
    if (ADD_TYPES[type] && !value) return invalid(`${label}.value cannot be empty for an additive proposal.`);
    planned.push({ index, type, strategyId, value, reason, field: UPDATE_TYPES[type] || ADD_TYPES[type] });
  }

  const currentRevision = getCaseRevision(caseItem) || INITIAL_CASE_REVISION;
  return { ok: true, goal, planned, stale: payload.baseRevision !== currentRevision, currentRevision, baseRevision: payload.baseRevision };
}

function appendUnique(existing, value) {
  return safeTextList([...(Array.isArray(existing) ? existing : []), value]);
}

export function applyStrategyDelta(caseItem, validation, acceptedIndexes = [], now = new Date().toISOString()) {
  if (!validation?.ok) return invalid("Validate the Strategy Delta before applying it.");
  const accepted = new Set(acceptedIndexes);
  const proposals = validation.planned.filter((proposal) => accepted.has(proposal.index));
  if (!proposals.length) return invalid("Select at least one Strategy proposal to apply.");
  let strategy = Array.isArray(caseItem?.strategy) ? [...caseItem.strategy] : [];
  for (const proposal of proposals) {
    if (proposal.type === "create-strategy") {
      strategy.push(normalizeRecord({ ...proposal.strategy, id: generateId(), type: "strategy", goalIds: [validation.goal.id], source: "ai-strategy-delta-1.0", createdAt: now, updatedAt: now }, "strategy"));
      continue;
    }
    strategy = strategy.map((record) => {
      if (record.id !== proposal.strategyId) return record;
      const patch = ADD_TYPES[proposal.type] ? { [proposal.field]: appendUnique(record[proposal.field], proposal.value) } : { [proposal.field]: proposal.value };
      return normalizeRecord({ ...record, ...patch, id: record.id, goalIds: record.goalIds, attachments: record.attachments || [], createdAt: record.createdAt, updatedAt: now }, "strategy");
    });
  }
  return { ok: true, caseData: { ...caseItem, strategy, updatedAt: now }, applied: proposals };
}

export function describeStrategyDeltaProposal(proposal, caseItem) {
  if (proposal.type === "create-strategy") return { title: "New Strategy", before: "", after: proposal.strategy.title, reason: proposal.reason, detail: proposal.strategy };
  const strategy = (caseItem?.strategy || []).find((item) => item.id === proposal.strategyId) || {};
  const label = proposal.field === "desiredOutcome" ? "Desired outcome" : proposal.field === "nextSteps" ? "Next step" : proposal.field === "assumptions" ? "Assumption" : proposal.field === "risks" ? "Risk" : proposal.field === "objective" ? "Objective" : "Rationale";
  return { title: `${strategy.title || "Untitled Strategy"}: ${label}`, before: ADD_TYPES[proposal.type] ? "Additive item" : String(strategy[proposal.field] || ""), after: proposal.value, reason: proposal.reason, detail: null };
}
