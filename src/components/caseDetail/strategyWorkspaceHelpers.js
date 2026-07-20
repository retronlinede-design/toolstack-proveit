import { parseCalendarDate } from "./recordDateOrdering.js";

const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

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

export function getStrategySummary(strategies = [], now = Date.now()) {
  return strategies.reduce((summary, strategy) => {
    summary.total += 1;
    if (isArchived(strategy)) summary.archived += 1;
    else summary.active += 1;
    if (!hasLinks(strategy)) summary.unlinked += 1;

    const updatedTime = parseTimestamp(strategy?.updatedAt);
    if (updatedTime !== null && updatedTime <= now && now - updatedTime <= FOURTEEN_DAYS_MS) {
      summary.recentlyUpdated += 1;
    }
    return summary;
  }, { total: 0, active: 0, archived: 0, unlinked: 0, recentlyUpdated: 0 });
}

export function filterStrategies(strategies = [], search = "", statusFilter = "all") {
  const query = search.trim().toLowerCase();

  return strategies.filter((strategy) => {
    if (statusFilter === "active" && isArchived(strategy)) return false;
    if (statusFilter === "archived" && !isArchived(strategy)) return false;
    if (statusFilter === "unlinked" && hasLinks(strategy)) return false;
    if (!query) return true;

    return [
      strategy?.title,
      strategy?.description,
      strategy?.notes,
      strategy?.status,
      strategy?.sequenceGroup,
      ...(Array.isArray(strategy?.tags) ? strategy.tags : []),
    ].some((value) => typeof value === "string" && value.toLowerCase().includes(query));
  });
}

export function sortStrategies(strategies = [], sortMode = "newest") {
  return [...strategies].sort((a, b) => {
    if (sortMode === "oldest") {
      return compareNullableTimes(getStrategyDate(a), getStrategyDate(b), "asc");
    }
    if (sortMode === "recently-updated") {
      return compareNullableTimes(parseTimestamp(a?.updatedAt), parseTimestamp(b?.updatedAt));
    }
    if (sortMode === "sequence-group") {
      const aGroup = String(a?.sequenceGroup || "").trim();
      const bGroup = String(b?.sequenceGroup || "").trim();
      if (!aGroup && bGroup) return 1;
      if (aGroup && !bGroup) return -1;
      const groupComparison = aGroup.localeCompare(bGroup, undefined, { sensitivity: "base" });
      if (groupComparison !== 0) return groupComparison;
    }
    return compareNullableTimes(getStrategyDate(a), getStrategyDate(b));
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
