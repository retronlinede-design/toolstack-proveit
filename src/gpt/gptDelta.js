import { applyRecordPatchToCase, normalizeActionSummary } from "../domain/caseDomain.js";

export function normalizeGptStrategyDelta(payload = {}) {
  if (!payload || typeof payload !== "object") {
    return { ok: false, reason: "Payload must be an object." };
  }

  if (payload.app !== "proveit" || payload.contractVersion !== "gpt-delta-1.0") {
    return { ok: false, reason: "Unsupported GPT delta contract." };
  }

  const caseId = payload.target?.caseId;
  if (!caseId || typeof caseId !== "string") {
    return { ok: false, reason: "GPT delta target.caseId is required." };
  }

  const strategyPatches = payload.operations?.patch?.strategy;
  if (!Array.isArray(strategyPatches)) {
    return { ok: false, reason: "GPT delta strategy patch must be an array." };
  }

  const textFields = ["title", "date", "description", "notes", "status"];
  const listFields = ["tags", "linkedRecordIds"];
  const patchableFields = [...textFields, ...listFields];

  const patches = [];

  for (const item of strategyPatches) {
    if (!item || typeof item !== "object" || typeof item.id !== "string" || !item.id) {
      return { ok: false, reason: "Each strategy patch must include an id." };
    }

    if (!item.patch || typeof item.patch !== "object" || Array.isArray(item.patch)) {
      return { ok: false, reason: "Each strategy patch must include a patch object." };
    }

    const patch = patchableFields.reduce((normalized, field) => {
      if (!Object.prototype.hasOwnProperty.call(item.patch, field)) return normalized;

      if (listFields.includes(field)) {
        normalized[field] = Array.isArray(item.patch[field]) ? item.patch[field] : [];
        return normalized;
      }

      normalized[field] = typeof item.patch[field] === "string" ? item.patch[field] : "";
      return normalized;
    }, {});

    if (Object.keys(patch).length === 0) {
      return { ok: false, reason: "Each strategy patch must include at least one supported field." };
    }

    patches.push({ id: item.id, patch });
  }

  return { ok: true, caseId, patches };
}

export function ingestGptStrategyDelta(caseItem, payload) {
  const normalized = normalizeGptStrategyDelta(payload);
  if (!normalized.ok) {
    return normalized;
  }

  if (!caseItem || String(normalized.caseId) !== String(caseItem.id || "")) {
    return { ok: false, reason: "GPT delta target case does not match the provided case." };
  }

  const updatedAt = new Date().toISOString();
  let updatedCase = caseItem;

  for (const item of normalized.patches) {
    const nextCase = applyRecordPatchToCase(
      updatedCase,
      "strategy",
      item.id,
      {
        ...item.patch,
        updatedAt,
      }
    );

    if (nextCase === updatedCase) {
      return { ok: false, reason: `Strategy record not found: ${item.id}` };
    }

    updatedCase = nextCase;
  }

  return { ok: true, case: updatedCase };
}

export function validateGptDeltaTarget(caseItem, payload = {}) {
  if (!caseItem || !payload || typeof payload !== "object") {
    return { ok: false, reason: "GPT delta requires a case and payload object." };
  }

  if (payload.app !== "proveit" || payload.contractVersion !== "gpt-delta-1.0") {
    return { ok: false, reason: "Unsupported GPT delta contract." };
  }

  const caseId = payload.target?.caseId;
  if (!caseId || typeof caseId !== "string") {
    return { ok: false, reason: "GPT delta target.caseId is required." };
  }

  if (String(caseId) !== String(caseItem.id || "")) {
    return { ok: false, reason: "GPT delta target case does not match the provided case." };
  }

  return { ok: true, caseId };
}

export function applyGptActionSummaryDeltaToCase(caseItem, actionSummaryPatch = {}) {
  if (!actionSummaryPatch || typeof actionSummaryPatch !== "object" || Array.isArray(actionSummaryPatch)) {
    return { ok: false, reason: "GPT delta actionSummary patch must be an object." };
  }

  const patchableFields = [
    "currentFocus",
    "nextActions",
    "importantReminders",
    "strategyFocus",
    "criticalDeadlines",
  ];

  const patch = patchableFields.reduce((normalized, field) => {
    if (Object.prototype.hasOwnProperty.call(actionSummaryPatch, field)) {
      normalized[field] = actionSummaryPatch[field];
    }
    return normalized;
  }, {});

  if (Object.keys(patch).length === 0) {
    return { ok: false, reason: "GPT delta actionSummary patch has no supported fields." };
  }

  return {
    ok: true,
    case: {
      ...caseItem,
      actionSummary: normalizeActionSummary({
        ...(caseItem.actionSummary || {}),
        ...patch,
        updatedAt: new Date().toISOString(),
      }),
      updatedAt: new Date().toISOString(),
    },
  };
}

export function ingestGptDelta(caseItem, payload) {
  const target = validateGptDeltaTarget(caseItem, payload);
  if (!target.ok) {
    return target;
  }

  const patch = payload.operations?.patch;
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) {
    return { ok: false, reason: "GPT delta operations.patch is required." };
  }

  let updatedCase = caseItem;
  let appliedCount = 0;

  if (Object.prototype.hasOwnProperty.call(patch, "actionSummary")) {
    const actionSummaryResult = applyGptActionSummaryDeltaToCase(updatedCase, patch.actionSummary);
    if (!actionSummaryResult.ok) {
      return actionSummaryResult;
    }
    updatedCase = actionSummaryResult.case;
    appliedCount += 1;
  }

  if (Object.prototype.hasOwnProperty.call(patch, "strategy")) {
    const strategyResult = ingestGptStrategyDelta(updatedCase, {
      app: payload.app,
      contractVersion: payload.contractVersion,
      target: payload.target,
      operations: {
        patch: {
          strategy: patch.strategy,
        },
      },
    });

    if (!strategyResult.ok) {
      return strategyResult;
    }

    updatedCase = strategyResult.case;
    appliedCount += 1;
  }

  if (appliedCount === 0) {
    return { ok: false, reason: "GPT delta has no supported patch sections." };
  }

  return { ok: true, case: updatedCase };
}

export function buildGptDeltaPreview(payload, currentCase, updatedCase) {
  const patch = payload?.operations?.patch || {};
  const supportedSections = [];
  const actionSummaryFields = [];

  if (patch.actionSummary && typeof patch.actionSummary === "object" && !Array.isArray(patch.actionSummary)) {
    ["currentFocus", "nextActions", "importantReminders", "strategyFocus", "criticalDeadlines"].forEach((field) => {
      if (Object.prototype.hasOwnProperty.call(patch.actionSummary, field)) {
        actionSummaryFields.push(field);
      }
    });

    if (actionSummaryFields.length > 0) {
      supportedSections.push("Action Summary");
    }
  }

  const strategyItems = Array.isArray(patch.strategy)
    ? patch.strategy
        .map((item) => {
          const recordId = typeof item?.id === "string" ? item.id : "";
          const currentRecord = (currentCase?.strategy || []).find((record) => String(record.id) === String(recordId));
          const updatedRecord = (updatedCase?.strategy || []).find((record) => String(record.id) === String(recordId));
          return {
            id: recordId,
            title: updatedRecord?.title || currentRecord?.title || "Untitled strategy",
          };
        })
        .filter((item) => item.id)
    : [];

  if (strategyItems.length > 0) {
    supportedSections.push("Strategy");
  }

  return {
    caseName: currentCase?.name || "Selected case",
    caseId: String(currentCase?.id || ""),
    contractVersion: payload?.contractVersion || "",
    supportedSections,
    actionSummaryFields,
    strategyItems,
  };
}

export function prepareGptDeltaPayloadForSelectedCase(payload, selectedCaseId) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return payload;

  const target = payload.target;
  if (target != null && (typeof target !== "object" || Array.isArray(target))) {
    return payload;
  }

  const currentCaseId = String(selectedCaseId || "");
  const incomingCaseId = target?.caseId;
  const shouldUseSelectedCaseId =
    incomingCaseId == null ||
    (typeof incomingCaseId === "string" && ["", "AUTO"].includes(incomingCaseId.trim().toUpperCase()));

  if (!shouldUseSelectedCaseId || !currentCaseId) {
    return payload;
  }

  return {
    ...payload,
    target: {
      ...(target || {}),
      caseId: currentCaseId,
    },
  };
}
