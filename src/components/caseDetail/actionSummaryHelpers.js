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

export function normalizeActionSummary(actionSummary = {}) {
  return {
    ...emptyActionSummary,
    ...actionSummary,
    currentFocus: safeText(actionSummary.currentFocus),
    nextActions: safeTextList(actionSummary.nextActions),
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
    nextActions: normalized.nextActions.join("\n"),
    importantReminders: normalized.importantReminders.join("\n"),
    strategyFocus: normalized.strategyFocus.join("\n"),
  };
}

export function formToActionSummary(form) {
  return {
    currentFocus: safeText(form.currentFocus),
    nextActions: safeText(form.nextActions).split("\n").filter(Boolean),
    importantReminders: safeText(form.importantReminders).split("\n").filter(Boolean),
    strategyFocus: safeText(form.strategyFocus).split("\n").filter(Boolean),
    updatedAt: new Date().toISOString(),
  };
}
