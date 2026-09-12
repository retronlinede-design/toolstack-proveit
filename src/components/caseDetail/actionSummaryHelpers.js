import { getActionText, isActionCompleted, normalizeNextAction, normalizeNextActions } from "../../domain/nextActions.js";
export { getActionText, isActionCompleted, normalizeNextAction, normalizeNextActions };

export const emptyActionSummaryForm = {
  currentFocus: "",
  nextActions: "",
  importantReminders: "",
  strategyFocus: "",
};

export const emptyActionSummary = {
  currentFocus: "",
  nextActions: [],
  importantReminders: [],
  strategyFocus: [],
  criticalDeadlines: [],
};

function safeText(value) {
  return typeof value === "string" ? value : "";
}

export function safeTextList(value) {
  return Array.isArray(value) ? value.filter(item => typeof item === "string") : [];
}

export function getActiveNextActions(actions = []) {
  return normalizeNextActions(actions).filter(action => !action.completed);
}

export function getCompletedNextActions(actions = []) {
  return normalizeNextActions(actions).filter(action => action.completed);
}

export function normalizeActionSummary(actionSummary = {}) {
  return {
    ...emptyActionSummary,
    ...actionSummary,
    currentFocus: safeText(actionSummary.currentFocus),
    nextActions: normalizeNextActions(actionSummary.nextActions),
    importantReminders: safeTextList(actionSummary.importantReminders),
    strategyFocus: safeTextList(actionSummary.strategyFocus),
    criticalDeadlines: safeTextList(actionSummary.criticalDeadlines),
  };
}

export function applyActionSummaryPatch(currentActionSummary = {}, patch = {}) {
  const nextActionSummary = { ...currentActionSummary };
  const patchableFields = [
    "currentFocus",
    "nextActions",
    "importantReminders",
    "strategyFocus",
    "criticalDeadlines",
    "updatedAt",
  ];

  patchableFields.forEach(field => {
    if (Object.prototype.hasOwnProperty.call(patch, field)) {
      nextActionSummary[field] = patch[field];
    }
  });

  const normalized = normalizeActionSummary(nextActionSummary);
  const patchedActionSummary = {
    ...nextActionSummary,
    currentFocus: normalized.currentFocus,
    nextActions: normalized.nextActions,
    importantReminders: normalized.importantReminders,
    strategyFocus: normalized.strategyFocus,
  };

  if (Object.prototype.hasOwnProperty.call(nextActionSummary, "criticalDeadlines")) {
    patchedActionSummary.criticalDeadlines = normalized.criticalDeadlines;
  }

  if (Object.prototype.hasOwnProperty.call(nextActionSummary, "updatedAt")) {
    patchedActionSummary.updatedAt = safeText(nextActionSummary.updatedAt);
  }

  return patchedActionSummary;
}

export function actionSummaryToForm(actionSummary = {}) {
  const normalized = normalizeActionSummary(actionSummary);

  return {
    currentFocus: normalized.currentFocus,
    nextActions: getActiveNextActions(normalized.nextActions).map(getActionText).join("\n"),
    importantReminders: normalized.importantReminders.join("\n"),
    strategyFocus: normalized.strategyFocus.join("\n"),
  };
}

export function formToActionSummary(form, existingActionSummary = {}) {
  const existing = normalizeActionSummary(existingActionSummary);
  const previousForm = actionSummaryToForm(existing);
  const unchangedActions = safeText(form.nextActions) === previousForm.nextActions;
  const available = getActiveNextActions(existing.nextActions).filter((action) => getActionText(action).trim());
  const editedActions = safeText(form.nextActions).split("\n").filter((text) => text.trim()).map((text) => {
    const match = available.findIndex((action) => getActionText(action).trim() === text.trim());
    return match >= 0 ? available.splice(match, 1)[0] : normalizeNextAction(text);
  });
  const result = {
    ...existingActionSummary,
    currentFocus: safeText(form.currentFocus),
    nextActions: unchangedActions ? existing.nextActions : [
      ...editedActions,
      ...existing.nextActions.filter((action) => action.completed || !getActionText(action).trim()),
    ],
    importantReminders: safeText(form.importantReminders).split("\n").filter(Boolean),
    strategyFocus: safeText(form.strategyFocus).split("\n").filter(Boolean),
  };
  const unchanged = Object.keys(result).every((key) => JSON.stringify(result[key]) === JSON.stringify(existing[key]));
  if (!unchanged) result.updatedAt = new Date().toISOString();
  else if (Object.hasOwn(existingActionSummary, "updatedAt")) result.updatedAt = existingActionSummary.updatedAt;
  return result;
}
