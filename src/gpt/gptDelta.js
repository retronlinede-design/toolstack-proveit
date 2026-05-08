import { applyRecordPatchToCase, normalizeActionSummary } from "../domain/caseDomain.js";

const SUPPORTED_PATCH_SECTIONS = ["actionSummary", "strategy"];
const ACTION_SUMMARY_FIELDS = [
  "currentFocus",
  "nextActions",
  "importantReminders",
  "strategyFocus",
  "criticalDeadlines",
];
const ACTION_SUMMARY_LIST_FIELDS = [
  "nextActions",
  "importantReminders",
  "strategyFocus",
  "criticalDeadlines",
];
const STRATEGY_TEXT_FIELDS = ["title", "date", "description", "notes", "status"];
const STRATEGY_LIST_FIELDS = ["tags", "linkedRecordIds"];
const STRATEGY_PATCHABLE_FIELDS = [...STRATEGY_TEXT_FIELDS, ...STRATEGY_LIST_FIELDS];

function getUnsupportedPatchSections(patch = {}) {
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) return [];
  return Object.keys(patch).filter((section) => !SUPPORTED_PATCH_SECTIONS.includes(section));
}

function listFields(fields = []) {
  return fields.join(", ");
}

function getDuplicateStringEntries(items = []) {
  if (!Array.isArray(items)) return [];

  const seen = new Set();
  const duplicates = new Set();
  items.forEach((item) => {
    if (typeof item !== "string") return;
    const normalized = item.trim().toLowerCase();
    if (!normalized) return;
    if (seen.has(normalized)) duplicates.add(item.trim());
    seen.add(normalized);
  });
  return [...duplicates];
}

function getExistingRecordIds(caseItem) {
  const ids = new Set();
  ["incidents", "evidence", "tasks", "strategy", "documents", "ledger"].forEach((collection) => {
    (Array.isArray(caseItem?.[collection]) ? caseItem[collection] : []).forEach((record) => {
      if (record?.id) ids.add(String(record.id));
    });
  });
  return ids;
}

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

  const patches = [];
  const warnings = [];
  const seenIds = new Set();

  for (const item of strategyPatches) {
    if (!item || typeof item !== "object" || typeof item.id !== "string" || !item.id) {
      return { ok: false, reason: "Each strategy patch must include an id." };
    }

    if (seenIds.has(item.id)) {
      return { ok: false, reason: `Duplicate strategy patch id: ${item.id}` };
    }
    seenIds.add(item.id);

    if (!item.patch || typeof item.patch !== "object" || Array.isArray(item.patch)) {
      return { ok: false, reason: "Each strategy patch must include a patch object." };
    }

    const unsupportedFields = Object.keys(item.patch).filter((field) => !STRATEGY_PATCHABLE_FIELDS.includes(field));
    if (unsupportedFields.length > 0) {
      warnings.push(`Strategy ${item.id} has unsupported field(s) for gpt-delta-1.0: ${listFields(unsupportedFields)}.`);
    }

    const patch = STRATEGY_PATCHABLE_FIELDS.reduce((normalized, field) => {
      if (!Object.prototype.hasOwnProperty.call(item.patch, field)) return normalized;

      if (STRATEGY_LIST_FIELDS.includes(field)) {
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

  return { ok: true, caseId, patches, warnings };
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
  const warnings = [...(normalized.warnings || [])];
  const existingRecordIds = getExistingRecordIds(caseItem);

  for (const item of normalized.patches) {
    if (Object.prototype.hasOwnProperty.call(item.patch, "linkedRecordIds")) {
      const invalidIds = (Array.isArray(item.patch.linkedRecordIds) ? item.patch.linkedRecordIds : [])
        .filter((id) => !existingRecordIds.has(String(id)));
      if (invalidIds.length > 0) {
        return {
          ok: false,
          reason: `Strategy ${item.id} has unknown linkedRecordIds: ${listFields(invalidIds)}.`,
        };
      }
    }

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

  return { ok: true, case: updatedCase, warnings };
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

  const warnings = [];
  const unsupportedFields = Object.keys(actionSummaryPatch).filter((field) => !ACTION_SUMMARY_FIELDS.includes(field));
  if (unsupportedFields.length > 0) {
    warnings.push(`actionSummary has unsupported field(s) for gpt-delta-1.0: ${listFields(unsupportedFields)}.`);
  }

  ACTION_SUMMARY_LIST_FIELDS.forEach((field) => {
    if (!Object.prototype.hasOwnProperty.call(actionSummaryPatch, field)) return;
    const duplicates = getDuplicateStringEntries(actionSummaryPatch[field]);
    if (duplicates.length > 0) {
      warnings.push(`actionSummary.${field} contains duplicate item(s): ${listFields(duplicates)}.`);
    }
  });

  const patch = ACTION_SUMMARY_FIELDS.reduce((normalized, field) => {
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
    warnings,
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

  const unsupportedSections = getUnsupportedPatchSections(patch);
  if (unsupportedSections.length > 0) {
    return {
      ok: false,
      reason: `Unsupported gpt-delta-1.0 patch section(s): ${listFields(unsupportedSections)}. Current importer supports only actionSummary and strategy patches.`,
    };
  }

  let updatedCase = caseItem;
  let appliedCount = 0;
  const warnings = [];

  if (Object.prototype.hasOwnProperty.call(patch, "actionSummary")) {
    const actionSummaryResult = applyGptActionSummaryDeltaToCase(updatedCase, patch.actionSummary);
    if (!actionSummaryResult.ok) {
      return actionSummaryResult;
    }
    updatedCase = actionSummaryResult.case;
    warnings.push(...(actionSummaryResult.warnings || []));
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
    warnings.push(...(strategyResult.warnings || []));
    appliedCount += 1;
  }

  if (appliedCount === 0) {
    return { ok: false, reason: "GPT delta has no supported patch sections." };
  }

  return { ok: true, case: updatedCase, warnings };
}

function formatPreviewValue(value) {
  if (Array.isArray(value)) return value.join("\n");
  if (value == null) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function buildFieldChanges(fields, currentSource = {}, updatedSource = {}) {
  return fields
    .map((field) => ({
      field,
      before: formatPreviewValue(currentSource?.[field]),
      after: formatPreviewValue(updatedSource?.[field]),
    }))
    .filter((change) => change.before !== change.after);
}

export function buildGptDeltaPreview(payload, currentCase, updatedCase, warnings = []) {
  const patch = payload?.operations?.patch || {};
  const supportedSections = [];
  const actionSummaryFields = [];
  const actionSummaryChanges = [];

  if (patch.actionSummary && typeof patch.actionSummary === "object" && !Array.isArray(patch.actionSummary)) {
    ACTION_SUMMARY_FIELDS.forEach((field) => {
      if (Object.prototype.hasOwnProperty.call(patch.actionSummary, field)) {
        actionSummaryFields.push(field);
      }
    });

    if (actionSummaryFields.length > 0) {
      supportedSections.push("Action Summary");
      actionSummaryChanges.push(...buildFieldChanges(
        actionSummaryFields,
        currentCase?.actionSummary || {},
        updatedCase?.actionSummary || {}
      ));
    }
  }

  const strategyItems = Array.isArray(patch.strategy)
    ? patch.strategy
        .map((item) => {
          const recordId = typeof item?.id === "string" ? item.id : "";
          const currentRecord = (currentCase?.strategy || []).find((record) => String(record.id) === String(recordId));
          const updatedRecord = (updatedCase?.strategy || []).find((record) => String(record.id) === String(recordId));
          const patchedFields = item?.patch && typeof item.patch === "object" && !Array.isArray(item.patch)
            ? STRATEGY_PATCHABLE_FIELDS.filter((field) => Object.prototype.hasOwnProperty.call(item.patch, field))
            : [];
          return {
            id: recordId,
            title: updatedRecord?.title || currentRecord?.title || "Untitled strategy",
            changes: buildFieldChanges(patchedFields, currentRecord || {}, updatedRecord || {}),
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
    actionSummaryChanges,
    strategyItems,
    warnings: Array.isArray(warnings) ? warnings : [],
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
