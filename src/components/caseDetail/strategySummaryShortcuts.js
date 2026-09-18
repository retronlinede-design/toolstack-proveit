export const DEFAULT_STRATEGY_LIST_FILTERS = {
  search: "",
  statusFilter: "all",
  strategyTypeFilter: "all",
  priorityFilter: "all",
  reviewStateFilter: "all",
};

const SHORTCUT_FILTERS = {
  all: {},
  active: { statusFilter: "active" },
  archived: { statusFilter: "archived" },
  unlinked: { statusFilter: "unlinked" },
  critical: { priorityFilter: "critical" },
  high: { priorityFilter: "high" },
  dueSoon: { reviewStateFilter: "due-soon" },
  overdue: { reviewStateFilter: "overdue" },
};

export function getStrategySummaryShortcutFilters(shortcut) {
  if (!Object.hasOwn(SHORTCUT_FILTERS, shortcut)) return null;
  return { ...DEFAULT_STRATEGY_LIST_FILTERS, ...SHORTCUT_FILTERS[shortcut] };
}

export function isStrategySummaryShortcutActive(shortcut, filters) {
  const shortcutFilters = getStrategySummaryShortcutFilters(shortcut);
  if (!shortcutFilters) return false;
  return Object.entries(shortcutFilters).every(([key, value]) => filters?.[key] === value);
}
