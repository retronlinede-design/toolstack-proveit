import {
  applyRecordPatchToCase,
  generateId,
  normalizeActionSummary,
  syncCaseLinks,
  upsertDocumentEntryInCase,
  upsertLedgerEntryInCase,
  upsertRecordInCase,
} from "../domain/caseDomain.js";

const SUPPORTED_PATCH_SECTIONS = ["actionSummary", "strategy"];
const SUPPORTED_CREATE_SECTIONS = ["incidents", "evidence", "documents", "ledger"];
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
const CREATE_FIELD_ALLOWLISTS = {
  incidents: [
    "tempId",
    "title",
    "date",
    "eventDate",
    "description",
    "notes",
    "status",
    "importance",
    "evidenceStatus",
    "isMilestone",
    "sequenceGroup",
    "tags",
    "source",
    "linkedEvidenceIds",
    "linkedRecordIds",
    "linkedIncidentRefs",
  ],
  evidence: [
    "tempId",
    "title",
    "date",
    "eventDate",
    "capturedAt",
    "description",
    "notes",
    "status",
    "importance",
    "relevance",
    "sourceType",
    "evidenceRole",
    "evidenceType",
    "functionSummary",
    "sequenceGroup",
    "tags",
    "source",
    "usedIn",
    "reviewNotes",
    "linkedIncidentIds",
    "linkedRecordIds",
    "linkedEvidenceIds",
  ],
  documents: [
    "tempId",
    "title",
    "category",
    "documentDate",
    "source",
    "summary",
    "textContent",
    "sequenceGroup",
    "tags",
    "linkedRecordIds",
    "basedOnEvidenceIds",
    "isTrackingRecord",
  ],
  ledger: [
    "tempId",
    "category",
    "subType",
    "label",
    "period",
    "expectedAmount",
    "paidAmount",
    "currency",
    "dueDate",
    "paymentDate",
    "status",
    "method",
    "reference",
    "counterparty",
    "proofType",
    "proofStatus",
    "notes",
    "batchLabel",
    "linkedRecordIds",
  ],
};
const LINK_FIELDS_BY_CREATE_SECTION = {
  incidents: ["linkedEvidenceIds", "linkedRecordIds"],
  evidence: ["linkedIncidentIds", "linkedRecordIds", "linkedEvidenceIds"],
  documents: ["linkedRecordIds", "basedOnEvidenceIds"],
  ledger: ["linkedRecordIds"],
};
const BINARY_CREATE_FIELDS = [
  "attachments",
  "availability",
  "dataUrl",
  "backupDataUrl",
  "file",
  "files",
  "storage",
];

function getUnsupportedPatchSections(patch = {}) {
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) return [];
  return Object.keys(patch).filter((section) => !SUPPORTED_PATCH_SECTIONS.includes(section));
}

function listFields(fields = []) {
  return fields.join(", ");
}

function safeText(value) {
  return typeof value === "string" ? value : "";
}

function getPayloadApp(payload = {}) {
  return typeof payload?.app === "string" ? payload.app.trim() : payload?.app;
}

function getPayloadContractVersion(payload = {}) {
  return typeof payload?.contractVersion === "string" ? payload.contractVersion.trim() : payload?.contractVersion;
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

function getExistingIdsBySection(caseItem) {
  return {
    incidents: new Set((Array.isArray(caseItem?.incidents) ? caseItem.incidents : []).map((item) => String(item.id || "")).filter(Boolean)),
    evidence: new Set((Array.isArray(caseItem?.evidence) ? caseItem.evidence : []).map((item) => String(item.id || "")).filter(Boolean)),
    documents: new Set((Array.isArray(caseItem?.documents) ? caseItem.documents : []).map((item) => String(item.id || "")).filter(Boolean)),
    ledger: new Set((Array.isArray(caseItem?.ledger) ? caseItem.ledger : []).map((item) => String(item.id || "")).filter(Boolean)),
    strategy: new Set((Array.isArray(caseItem?.strategy) ? caseItem.strategy : []).map((item) => String(item.id || "")).filter(Boolean)),
    tasks: new Set((Array.isArray(caseItem?.tasks) ? caseItem.tasks : []).map((item) => String(item.id || "")).filter(Boolean)),
  };
}

function mapSectionToRecordType(section) {
  if (section === "incidents") return "incident";
  if (section === "evidence") return "evidence";
  if (section === "documents") return "document";
  if (section === "ledger") return "ledger";
  return section;
}

function getCreateTitle(section, item = {}) {
  return section === "ledger" ? safeText(item.label).trim() : safeText(item.title).trim();
}

function hasBinaryCreateField(item = {}) {
  return BINARY_CREATE_FIELDS.filter((field) => Object.prototype.hasOwnProperty.call(item, field));
}

function resolveId(id, tempIdMap) {
  const key = String(id || "");
  return tempIdMap.get(key) || key;
}

function resolveIdList(ids, tempIdMap) {
  if (!Array.isArray(ids)) return [];
  return ids.map((id) => resolveId(id, tempIdMap)).filter(Boolean);
}

function collectCreateItems(create = {}) {
  return SUPPORTED_CREATE_SECTIONS.flatMap((section) =>
    (Array.isArray(create?.[section]) ? create[section] : []).map((item, index) => ({
      section,
      index,
      item,
    }))
  );
}

export function normalizeGptStrategyDelta(payload = {}) {
  if (!payload || typeof payload !== "object") {
    return { ok: false, reason: "Payload must be an object." };
  }

  if (getPayloadApp(payload) !== "proveit" || getPayloadContractVersion(payload) !== "gpt-delta-1.0") {
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

function defaultEvidenceAvailability() {
  return {
    physical: { hasOriginal: false, location: "", notes: "" },
    digital: { hasDigital: false, files: [] },
  };
}

function buildCreatedRecordPreview(recordType, record, planned, tempIdMap) {
  const source = planned.item || {};
  const linkFields = LINK_FIELDS_BY_CREATE_SECTION[planned.section] || [];
  const links = linkFields.reduce((result, field) => {
    const raw = Array.isArray(source[field]) ? source[field] : [];
    if (raw.length > 0) result[field] = resolveIdList(raw, tempIdMap);
    return result;
  }, {});

  if (Array.isArray(source.linkedIncidentRefs) && source.linkedIncidentRefs.length > 0) {
    links.linkedIncidentRefs = source.linkedIncidentRefs.map((ref) => ({
      ...ref,
      incidentId: resolveId(ref?.incidentId, tempIdMap),
    }));
  }

  return {
    id: record?.id || planned.finalId,
    tempId: planned.tempId || "",
    recordType,
    title: record?.title || record?.label || planned.title,
    links,
  };
}

function createRecordInput(planned, tempIdMap) {
  const item = planned.item || {};
  const common = {
    ...item,
    id: planned.finalId,
    attachments: [],
    linkedRecordIds: resolveIdList(item.linkedRecordIds, tempIdMap),
  };
  delete common.tempId;
  delete common.isTrackingRecord;

  if (planned.section === "incidents") {
    return {
      ...common,
      title: safeText(item.title).trim(),
      date: item.date || item.eventDate || "",
      description: item.description || "",
      notes: item.notes || "",
      availability: defaultEvidenceAvailability(),
      linkedEvidenceIds: resolveIdList(item.linkedEvidenceIds, tempIdMap),
      linkedIncidentRefs: Array.isArray(item.linkedIncidentRefs)
        ? item.linkedIncidentRefs.map((ref) => ({
            ...ref,
            incidentId: resolveId(ref?.incidentId, tempIdMap),
          }))
        : [],
    };
  }

  if (planned.section === "evidence") {
    return {
      ...common,
      title: safeText(item.title).trim(),
      date: item.date || item.eventDate || item.capturedAt || "",
      description: item.description || "",
      notes: item.notes || "",
      availability: defaultEvidenceAvailability(),
      linkedIncidentIds: resolveIdList(item.linkedIncidentIds, tempIdMap),
      linkedEvidenceIds: resolveIdList(item.linkedEvidenceIds, tempIdMap),
    };
  }

  if (planned.section === "documents") {
    return {
      ...common,
      title: safeText(item.title).trim(),
      attachments: [],
      basedOnEvidenceIds: resolveIdList(item.basedOnEvidenceIds, tempIdMap),
    };
  }

  return {
    ...common,
    label: safeText(item.label).trim(),
  };
}

export function ingestGptCreateDelta(caseItem, payload) {
  const normalized = normalizeGptCreateDelta(caseItem, payload);
  if (!normalized.ok) return normalized;

  let updatedCase = caseItem;
  const createdRecords = [];
  const createdSyncRecords = [];
  const warnings = [...(normalized.warnings || [])];

  for (const planned of normalized.plannedCreates) {
    const input = createRecordInput(planned, normalized.tempIdMap);

    if (planned.section === "incidents") {
      updatedCase = upsertRecordInCase(updatedCase, "incidents", input);
      const record = (updatedCase.incidents || []).find((item) => item.id === planned.finalId);
      createdRecords.push(buildCreatedRecordPreview("incident", record, planned, normalized.tempIdMap));
      if (record) createdSyncRecords.push({ record, type: "incidents" });
    } else if (planned.section === "evidence") {
      updatedCase = upsertRecordInCase(updatedCase, "evidence", input);
      const record = (updatedCase.evidence || []).find((item) => item.id === planned.finalId);
      createdRecords.push(buildCreatedRecordPreview("evidence", record, planned, normalized.tempIdMap));
      if (record) createdSyncRecords.push({ record, type: "evidence" });
    } else if (planned.section === "documents") {
      if (Array.isArray(planned.item.tags) && planned.item.tags.length > 0) {
        warnings.push(`documents.create ${planned.title} includes tags, but document tags are not persisted in the current case schema.`);
      }
      updatedCase = upsertDocumentEntryInCase(updatedCase, input);
      const record = (updatedCase.documents || []).find((item) => item.id === planned.finalId);
      createdRecords.push(buildCreatedRecordPreview("document", record, planned, normalized.tempIdMap));
    } else if (planned.section === "ledger") {
      updatedCase = upsertLedgerEntryInCase(updatedCase, input);
      const record = (updatedCase.ledger || []).find((item) => item.id === planned.finalId);
      createdRecords.push(buildCreatedRecordPreview("ledger", record, planned, normalized.tempIdMap));
    }
  }

  for (const item of createdSyncRecords) {
    const latestRecord = (updatedCase[item.type] || []).find((record) => record.id === item.record.id);
    if (latestRecord) {
      updatedCase = syncCaseLinks(updatedCase, latestRecord, item.type);
    }
  }

  const tempIdMappings = [...normalized.tempIdMap.entries()].map(([tempId, finalId]) => ({
    tempId,
    finalId,
  }));

  return {
    ok: true,
    case: updatedCase,
    warnings,
    createdRecords,
    tempIdMappings,
  };
}

export function validateGptDeltaTarget(caseItem, payload = {}, allowedVersions = ["gpt-delta-1.0"]) {
  if (!caseItem || !payload || typeof payload !== "object") {
    return { ok: false, reason: "GPT delta requires a case and payload object." };
  }

  if (getPayloadApp(payload) !== "proveit" || !allowedVersions.includes(getPayloadContractVersion(payload))) {
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

export function normalizeGptCreateDelta(caseItem, payload = {}) {
  const target = validateGptDeltaTarget(caseItem, payload, ["gpt-delta-2.0"]);
  if (!target.ok) return target;

  if (Object.prototype.hasOwnProperty.call(payload.operations || {}, "patch")) {
    return { ok: false, reason: "gpt-delta-2.0 supports create operations only. Patch operations are not supported in this contract." };
  }

  const create = payload.operations?.create;
  if (!create || typeof create !== "object" || Array.isArray(create)) {
    return { ok: false, reason: "GPT delta operations.create is required for gpt-delta-2.0." };
  }

  const unsupportedSections = Object.keys(create).filter((section) => !SUPPORTED_CREATE_SECTIONS.includes(section));
  if (unsupportedSections.length > 0) {
    return {
      ok: false,
      reason: `Unsupported gpt-delta-2.0 create section(s): ${listFields(unsupportedSections)}. Current create support is incidents, evidence, documents, and ledger.`,
    };
  }

  for (const section of SUPPORTED_CREATE_SECTIONS) {
    if (Object.prototype.hasOwnProperty.call(create, section) && !Array.isArray(create[section])) {
      return { ok: false, reason: `GPT delta ${section}.create must be an array.` };
    }
  }

  const allCreateItems = collectCreateItems(create);
  if (allCreateItems.length === 0) {
    return { ok: false, reason: "GPT delta create operation has no supported records to create." };
  }

  const tempIdMap = new Map();
  const tempIdSections = new Map();
  const plannedCreates = [];
  const warnings = [];

  for (const { section, index, item } of allCreateItems) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return { ok: false, reason: `Each ${section}.create item must be an object.` };
    }

    const binaryFields = hasBinaryCreateField(item);
    if (binaryFields.length > 0) {
      return { ok: false, reason: `${section}.create does not support binary or attachment field(s): ${listFields(binaryFields)}.` };
    }

    const unsupportedFields = Object.keys(item).filter((field) => !CREATE_FIELD_ALLOWLISTS[section].includes(field));
    if (unsupportedFields.length > 0) {
      return { ok: false, reason: `${section}.create has unsupported field(s): ${listFields(unsupportedFields)}.` };
    }

    const title = getCreateTitle(section, item);
    if (!title) {
      return { ok: false, reason: `${section}.create item ${index + 1} requires ${section === "ledger" ? "label" : "title"}.` };
    }

    if (item.tempId != null && typeof item.tempId !== "string") {
      return { ok: false, reason: `${section}.create item ${title} has a non-string tempId.` };
    }

    const tempId = safeText(item.tempId).trim();
    const finalId = generateId();
    if (tempId) {
      if (tempIdMap.has(tempId)) {
        return { ok: false, reason: `Duplicate GPT temporary id in create operations: ${tempId}.` };
      }
      tempIdMap.set(tempId, finalId);
      tempIdSections.set(tempId, section);
    }

    if (section === "documents" && item.isTrackingRecord && !safeText(item.textContent).includes("[TRACK RECORD]")) {
      warnings.push(`documents.create ${title} has isTrackingRecord=true but textContent does not contain [TRACK RECORD]; it will be saved as a normal document.`);
    }

    plannedCreates.push({ section, index, item, tempId, finalId, title });
  }

  const validIds = getExistingRecordIds(caseItem);
  const existingIdsBySection = getExistingIdsBySection(caseItem);
  [...tempIdMap.values()].forEach((id) => validIds.add(String(id)));
  const validTempIds = new Set(tempIdMap.keys());
  const isValidTypedLink = (id, targetSection) => {
    const key = String(id || "");
    if (!key) return false;
    if (existingIdsBySection[targetSection]?.has(key)) return true;
    if (!validTempIds.has(key)) return false;
    return tempIdSections.get(key) === targetSection;
  };
  const getTargetSectionForLinkField = (field) => {
    if (field === "linkedIncidentIds") return "incidents";
    if (field === "linkedEvidenceIds" || field === "basedOnEvidenceIds") return "evidence";
    return "";
  };

  const validateLinkedIds = (planned) => {
    const linkFields = LINK_FIELDS_BY_CREATE_SECTION[planned.section] || [];
    for (const field of linkFields) {
      if (!Object.prototype.hasOwnProperty.call(planned.item, field)) continue;
      if (!Array.isArray(planned.item[field])) {
        return `${planned.section}.create ${planned.title} field ${field} must be an array.`;
      }
      const targetSection = getTargetSectionForLinkField(field);
      const invalidIds = planned.item[field].filter((id) => {
        const key = String(id || "");
        if (!key) return true;
        if (targetSection) return !isValidTypedLink(key, targetSection);
        return !validIds.has(key) && !validTempIds.has(key);
      });
      if (invalidIds.length > 0) {
        return `${planned.section}.create ${planned.title} has unknown ${field}: ${listFields(invalidIds)}.`;
      }
    }
    return "";
  };

  for (const planned of plannedCreates) {
    const linkError = validateLinkedIds(planned);
    if (linkError) return { ok: false, reason: linkError };

    if (Array.isArray(planned.item.linkedIncidentRefs)) {
      const invalidRefs = planned.item.linkedIncidentRefs.filter((ref) => {
        const incidentId = String(ref?.incidentId || "");
        return !isValidTypedLink(incidentId, "incidents");
      });
      if (invalidRefs.length > 0) {
        return { ok: false, reason: `${planned.section}.create ${planned.title} has unknown linkedIncidentRefs incidentId.` };
      }
    }
  }

  return { ok: true, caseId: target.caseId, plannedCreates, tempIdMap, warnings };
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
  if (getPayloadContractVersion(payload) === "gpt-delta-2.0") {
    return ingestGptCreateDelta(caseItem, payload);
  }

  const target = validateGptDeltaTarget(caseItem, payload, ["gpt-delta-1.0"]);
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
      contractVersion: getPayloadContractVersion(payload),
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

export function buildGptDeltaPreview(payload, currentCase, updatedCase, resultMeta = []) {
  const patch = payload?.operations?.patch || {};
  const create = payload?.operations?.create || {};
  const metadata = Array.isArray(resultMeta) ? { warnings: resultMeta } : (resultMeta || {});
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

  const createdRecords = Array.isArray(metadata.createdRecords) ? metadata.createdRecords : [];
  if (createdRecords.length > 0) {
    const createSections = SUPPORTED_CREATE_SECTIONS.filter((section) =>
      Array.isArray(create?.[section]) && create[section].length > 0
    );
    supportedSections.push(...createSections.map((section) => `${section}.create`));
  }

  return {
    caseName: currentCase?.name || "Selected case",
    caseId: String(currentCase?.id || ""),
    contractVersion: getPayloadContractVersion(payload) || "",
    supportedSections,
    actionSummaryFields,
    actionSummaryChanges,
    strategyItems,
    createdRecords,
    tempIdMappings: Array.isArray(metadata.tempIdMappings) ? metadata.tempIdMappings : [],
    warnings: Array.isArray(metadata.warnings) ? metadata.warnings : [],
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
