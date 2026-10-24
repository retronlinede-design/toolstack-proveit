const text = (value) => typeof value === "string" ? value : "";
const strings = (value) => Array.isArray(value) ? value.filter((item) => typeof item === "string" && item) : [];

/**
 * The safe, analysis-relevant subset of a canonical Goal. Keep this explicit:
 * Goals may gain UI-only or private fields without expanding AI exports.
 */
export function projectGoalForAnalysis(goal = {}) {
  return {
    id: text(goal.id),
    title: text(goal.title),
    description: text(goal.description),
    successCriteria: strings(goal.successCriteria),
    status: text(goal.status),
    priority: text(goal.priority),
    issueIds: strings(goal.issueIds),
    reviewDate: text(goal.reviewDate),
    createdAt: text(goal.createdAt),
    updatedAt: text(goal.updatedAt),
  };
}
