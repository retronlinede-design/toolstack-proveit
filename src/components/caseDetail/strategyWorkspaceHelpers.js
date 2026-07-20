import { parseCalendarDate } from "./recordDateOrdering.js";

const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;
const PRIORITY_RANKS = { critical: 0, high: 1, medium: 2, low: 3 };

function isArchived(strategy) {
  return String(strategy?.status || "").trim().toLowerCase() === "archived";
}

function hasLinks(strategy) {
  return ["linkedRecordIds", "linkedIncidentIds", "linkedEvidenceIds"]
    .some((field) => Array.isArray(strategy?.[field]) && strategy[field].length > 0);
}

function getStrategyDate(strategy) {
  return parseCalendarDate(strategy?.eventDate || strategy?.date);
}

function getReviewDate(strategy) {
  return parseCalendarDate(strategy?.reviewDate);
}

function getPriorityRank(strategy) {
  const priority = String(strategy?.priority || "").trim().toLowerCase();
  return PRIORITY_RANKS[priority] ?? 4;
}

function getLocalCalendarDate(now) {
  const date = new Date(now);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function compareNullableTimes(aTime, bTime, direction = "desc") {
  if (aTime === null && bTime === null) return 0;
  if (aTime === null) return 1;
  if (bTime === null) return -1;
  return direction === "asc" ? aTime - bTime : bTime - aTime;
}

function parseTimestamp(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

function compareStrategyFallback(a, b) {
  const dateComparison = compareNullableTimes(getStrategyDate(a), getStrategyDate(b));
  if (dateComparison !== 0) return dateComparison;
  return String(a?.id || "").localeCompare(String(b?.id || ""));
}

export function getStrategyReviewState(strategy, today = getLocalCalendarDate(Date.now())) {
  const reviewTime = getReviewDate(strategy);
  const todayTime = parseCalendarDate(today);
  if (reviewTime === null) return "no-review-date";
  if (todayTime === null) return "scheduled";
  if (reviewTime < todayTime) return "overdue";
  if (reviewTime <= todayTime + FOURTEEN_DAYS_MS) return "due-soon";
  return "scheduled";
}

export function resolveStrategyOwner(strategy, parties = []) {
  const ownerPartyId = typeof strategy?.ownerPartyId === "string" ? strategy.ownerPartyId.trim() : "";
  if (!ownerPartyId) return null;
  const party = parties.find((candidate) => candidate?.id === ownerPartyId);
  return party
    ? { id: ownerPartyId, name: party.displayName || party.organisationName || "Untitled Party", missing: false }
    : { id: ownerPartyId, name: "Unknown owner", missing: true };
}

export function getStrategySummary(strategies = [], now = Date.now()) {
  const today = getLocalCalendarDate(now);
  return strategies.reduce((summary, strategy) => {
    summary.total += 1;
    if (isArchived(strategy)) summary.archived += 1;
    else summary.active += 1;
    if (!hasLinks(strategy)) summary.unlinked += 1;
    const priority = String(strategy?.priority || "").trim().toLowerCase();
    if (priority === "critical") summary.criticalPriority += 1;
    if (priority === "high") summary.highPriority += 1;
    const reviewState = getStrategyReviewState(strategy, today);
    if (reviewState === "due-soon") summary.dueForReview += 1;
    if (reviewState === "overdue") summary.overdueReview += 1;
    if (!isArchived(strategy) && Array.isArray(strategy?.nextSteps) && strategy.nextSteps.some((step) => typeof step === "string" && step.trim())) {
      summary.openNextSteps += 1;
    }

    const updatedTime = parseTimestamp(strategy?.updatedAt);
    if (updatedTime !== null && updatedTime <= now && now - updatedTime <= FOURTEEN_DAYS_MS) {
      summary.recentlyUpdated += 1;
    }
    return summary;
  }, {
    total: 0,
    active: 0,
    archived: 0,
    unlinked: 0,
    recentlyUpdated: 0,
    criticalPriority: 0,
    highPriority: 0,
    dueForReview: 0,
    overdueReview: 0,
    openNextSteps: 0,
  });
}

export function filterStrategies(strategies = [], search = "", statusFilter = "all", filters = {}) {
  const query = search.trim().toLowerCase();
  const { strategyType = "all", priority = "all", reviewState = "all", today } = filters;

  return strategies.filter((strategy) => {
    if (statusFilter === "active" && isArchived(strategy)) return false;
    if (statusFilter === "archived" && !isArchived(strategy)) return false;
    if (statusFilter === "unlinked" && hasLinks(strategy)) return false;
    if (strategyType !== "all" && String(strategy?.strategyType || "").trim().toLowerCase() !== strategyType) return false;
    if (priority !== "all" && String(strategy?.priority || "").trim().toLowerCase() !== priority) return false;
    if (reviewState !== "all" && getStrategyReviewState(strategy, today) !== reviewState) return false;
    if (!query) return true;

    return [
      strategy?.title,
      strategy?.description,
      strategy?.notes,
      strategy?.status,
      strategy?.sequenceGroup,
      strategy?.strategyType,
      strategy?.objective,
      strategy?.rationale,
      strategy?.desiredOutcome,
      strategy?.priority,
      strategy?.reviewDate,
      strategy?.decisionStatus,
      ...(Array.isArray(strategy?.assumptions) ? strategy.assumptions : []),
      ...(Array.isArray(strategy?.risks) ? strategy.risks : []),
      ...(Array.isArray(strategy?.nextSteps) ? strategy.nextSteps : []),
      ...(Array.isArray(strategy?.tags) ? strategy.tags : []),
    ].some((value) => typeof value === "string" && value.toLowerCase().includes(query));
  });
}

export function sortStrategies(strategies = [], sortMode = "newest") {
  return [...strategies].sort((a, b) => {
    if (sortMode === "oldest") {
      const comparison = compareNullableTimes(getStrategyDate(a), getStrategyDate(b), "asc");
      return comparison || String(a?.id || "").localeCompare(String(b?.id || ""));
    }
    if (sortMode === "recently-updated") {
      const comparison = compareNullableTimes(parseTimestamp(a?.updatedAt), parseTimestamp(b?.updatedAt));
      return comparison || compareStrategyFallback(a, b);
    }
    if (sortMode === "priority") {
      const comparison = getPriorityRank(a) - getPriorityRank(b);
      return comparison || compareStrategyFallback(a, b);
    }
    if (sortMode === "review-date") {
      const comparison = compareNullableTimes(getReviewDate(a), getReviewDate(b), "asc");
      return comparison || compareStrategyFallback(a, b);
    }
    if (sortMode === "sequence-group") {
      const aGroup = String(a?.sequenceGroup || "").trim();
      const bGroup = String(b?.sequenceGroup || "").trim();
      if (!aGroup && bGroup) return 1;
      if (aGroup && !bGroup) return -1;
      const groupComparison = aGroup.localeCompare(bGroup, undefined, { sensitivity: "base" });
      if (groupComparison !== 0) return groupComparison;
    }
    const comparison = compareNullableTimes(getStrategyDate(a), getStrategyDate(b));
    return comparison || String(a?.id || "").localeCompare(String(b?.id || ""));
  });
}

export function groupStrategiesBySequenceGroup(strategies = []) {
  const groups = new Map();
  strategies.forEach((strategy) => {
    const groupName = String(strategy?.sequenceGroup || "").trim() || "Ungrouped";
    if (!groups.has(groupName)) groups.set(groupName, []);
    groups.get(groupName).push(strategy);
  });
  return [...groups.entries()].map(([name, items]) => ({ name, items }));
}
