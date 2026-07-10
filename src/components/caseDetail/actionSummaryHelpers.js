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

function safeIsoTimestamp(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function getActionText(action) {
  if (typeof action === "string") return action;
  return typeof action?.text === "string" ? action.text : "";
}

export function isActionCompleted(action) {
  return typeof action === "object" && action !== null && action.completed === true;
}

export function normalizeNextAction(action) {
  const text = getActionText(action).trim();
  if (!text) return null;

  const completed = isActionCompleted(action);
  return {
    text,
    completed,
    completedAt: completed ? safeIsoTimestamp(action.completedAt) : null,
  };
}

export function normalizeNextActions(value) {
  if (!Array.isArray(value)) return [];

  return value.reduce((actions, action) => {
    const normalized = normalizeNextAction(action);
    if (normalized) actions.push(normalized);
    return actions;
  }, []);
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
  const completedActions = getCompletedNextActions(existingActionSummary.nextActions);

  return {
    currentFocus: safeText(form.currentFocus),
    nextActions: [
      ...safeText(form.nextActions).split("\n").filter(Boolean).map(text => ({
        text,
        completed: false,
        completedAt: null,
      })),
      ...completedActions,
    ],
    importantReminders: safeText(form.importantReminders).split("\n").filter(Boolean),
    strategyFocus: safeText(form.strategyFocus).split("\n").filter(Boolean),
    updatedAt: new Date().toISOString(),
  };
}
