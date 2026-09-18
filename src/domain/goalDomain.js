import { generateId } from "./id.js";

export const GOAL_STATUSES = ["active", "achieved", "abandoned", "archived"];
export const GOAL_PRIORITIES = ["low", "medium", "high", "critical"];

function text(value) { return typeof value === "string" ? value.trim() : ""; }
function list(value) { return Array.isArray(value) ? value : []; }

function normalizeTextList(value) {
  const seen = new Set();
  return list(value).reduce((items, item) => {
    const normalized = text(item);
    if (!normalized || seen.has(normalized)) return items;
    seen.add(normalized);
    items.push(normalized);
    return items;
  }, []);
}

export function normalizeGoalIds(value) { return normalizeTextList(value); }
export function normalizeGoalIssueIds(value) { return normalizeTextList(value); }

export function normalizeGoal(item = {}) {
  const now = new Date().toISOString();
  const createdAt = text(item?.createdAt) || now;
  const status = text(item?.status).toLowerCase();
  const priority = text(item?.priority).toLowerCase();
  return {
    id: text(item?.id) || generateId(),
    title: text(item?.title),
    description: text(item?.description),
    successCriteria: normalizeTextList(item?.successCriteria),
    status: GOAL_STATUSES.includes(status) ? status : "active",
    priority: GOAL_PRIORITIES.includes(priority) ? priority : "medium",
    issueIds: normalizeGoalIssueIds(item?.issueIds),
    reviewDate: text(item?.reviewDate),
    createdAt,
    updatedAt: text(item?.updatedAt) || createdAt,
  };
}

export function normalizeGoals(value) { return list(value).map((goal) => normalizeGoal(goal)); }
