import { getStrictCalendarDate, normalizeWatchItem } from "../../domain/caseDomain.js";

export const WATCH_REVIEW_STATES = ["all", "due", "overdue", "scheduled", "unscheduled"];
const PRIORITY_RANK = { critical: 0, high: 1, medium: 2, low: 3, "": 4 };

export function getWatchReviewState(item, today = new Date().toISOString().slice(0, 10)) {
  const reviewDate = getStrictCalendarDate(item?.reviewDate);
  if (!reviewDate) return "unscheduled";
  if (reviewDate < today) return "overdue";
  if (reviewDate === today) return "due";
  return "scheduled";
}

export function isWatchItemUnlinked(item) {
  return (!Array.isArray(item?.linkedRecordIds) || item.linkedRecordIds.length === 0)
    && (!Array.isArray(item?.linkedPartyIds) || item.linkedPartyIds.length === 0);
}

export function filterAndSortWatchItems(items = [], filters = {}, today) {
  const query = String(filters.search || "").trim().toLowerCase();
  const filtered = (Array.isArray(items) ? items : []).filter((item) => {
    const searchable = [item.title, item.watchFor, item.rationale, item.latestObservation, item.nextCheck, item.sequenceGroup, ...(item.tags || []), ...(item.triggerConditions || [])].join(" ").toLowerCase();
    return (!query || searchable.includes(query))
      && (!filters.status || filters.status === "all" || item.status === filters.status)
      && (!filters.category || filters.category === "all" || item.category === filters.category)
      && (!filters.priority || filters.priority === "all" || item.priority === filters.priority)
      && (!filters.reviewState || filters.reviewState === "all" || getWatchReviewState(item, today) === filters.reviewState);
  });
  return [...filtered].sort((a, b) => {
    if (filters.sort === "oldest") return a.date.localeCompare(b.date) || a.id.localeCompare(b.id);
    if (filters.sort === "updated") return b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id);
    if (filters.sort === "priority") return (PRIORITY_RANK[a.priority] ?? 5) - (PRIORITY_RANK[b.priority] ?? 5) || b.updatedAt.localeCompare(a.updatedAt);
    if (filters.sort === "review") return (a.reviewDate || "9999-99-99").localeCompare(b.reviewDate || "9999-99-99") || a.id.localeCompare(b.id);
    if (filters.sort === "sequence") return (a.sequenceGroup || "￿").localeCompare(b.sequenceGroup || "￿") || a.title.localeCompare(b.title);
    return b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id);
  });
}

export function prepareWatchItemForm(item) {
  return normalizeWatchItem(item || {});
}
