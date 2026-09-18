import { normalizeGoal } from "../../domain/goalDomain.js";

export function prepareGoalDraft(goal = {}) {
  return {
    title: goal.title || "",
    description: goal.description || "",
    successCriteria: Array.isArray(goal.successCriteria) ? [...goal.successCriteria] : [],
    status: goal.status || "active",
    priority: goal.priority || "medium",
    issueIds: Array.isArray(goal.issueIds) ? [...goal.issueIds] : [],
    reviewDate: goal.reviewDate || "",
  };
}

export function saveGoalToCase(caseItem, draft, goalId = "", now = new Date().toISOString()) {
  const goals = Array.isArray(caseItem?.goals) ? caseItem.goals : [];
  const existing = goals.find((goal) => goal.id === goalId);
  const savedGoal = normalizeGoal({
    ...existing,
    ...draft,
    ...(goalId ? { id: goalId } : {}),
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  });
  const nextGoals = existing
    ? goals.map((goal) => goal.id === savedGoal.id ? savedGoal : goal)
    : [...goals, savedGoal];
  return { caseData: { ...caseItem, goals: nextGoals, updatedAt: now }, goal: savedGoal };
}

export function toggleGoalIssueId(issueIds, issueId, checked) {
  const current = Array.isArray(issueIds) ? issueIds : [];
  return checked
    ? [...new Set([...current, issueId])]
    : current.filter((id) => id !== issueId);
}

export function getVisibleGoals(goals = [], view = "active") {
  const items = Array.isArray(goals) ? goals : [];
  return view === "all" ? items : items.filter((goal) => goal.status === "active");
}
