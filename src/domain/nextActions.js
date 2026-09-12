export function getActionText(action) {
  if (typeof action === "string") return action;
  return typeof action?.text === "string" ? action.text : "";
}

export function isActionCompleted(action) {
  return typeof action === "object" && action !== null && action.completed === true;
}

function completionTimestamp(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function normalizeNextAction(action) {
  const structured = action !== null && typeof action === "object";
  const text = getActionText(action).trim();
  // Unknown historical objects are opaque data, not blank legacy input.
  if (!text || Array.isArray(action)) {
    if (structured) return structuredClone(action);
    return null;
  }
  const completed = isActionCompleted(action);
  return {
    ...(structured ? action : {}),
    text,
    completed,
    completedAt: completed ? completionTimestamp(action.completedAt) : null,
  };
}

export function normalizeNextActions(value) {
  if (!Array.isArray(value)) return [];
  return value.map(normalizeNextAction).filter((action) => action !== null);
}

// A display/export projection is intentionally separate from canonical storage.
// Refuse an unsupported object explicitly rather than emit an empty action list.
export function projectNextActionTexts(value) {
  if (!Array.isArray(value)) return [];
  return value.map((action, index) => {
    const text = getActionText(action).trim();
    if (action !== null && typeof action === "object" && (!text || Array.isArray(action))) {
      throw new Error(`Cannot project nextActions[${index}]: expected an action object with non-empty text.`);
    }
    return text;
  }).filter(Boolean);
}
