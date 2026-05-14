import {
  EVIDENCE_ROLES,
  EVIDENCE_TYPES,
  INCIDENT_EVIDENCE_STATUSES,
  applyRecordPatchToCase,
  generateId,
  normalizeActionSummary,
  syncCaseLinks,
  upsertDocumentEntryInCase,
  upsertLedgerEntryInCase,
  upsertRecordInCase,
} from "../domain/caseDomain.js";

const SUPPORTED_PATCH_SECTIONS = ["actionSummary", "strategy"];
const SUPPORTED_V2_PATCH_SECTIONS = ["incidents", "evidence", "documents", "ledger", "strategy"];
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
const PATCH_FIELD_ALLOWLISTS = {
  incidents: [
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
  strategy: [
    "title",
    "date",
    "eventDate",
    "description",
    "notes",
    "status",
    "tags",
    "source",
    "sequenceGroup",
    "linkedRecordIds",
    "linkedIncidentIds",
    "linkedEvidenceIds",
  ],
};
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
const LINK_FIELDS_BY_PATCH_SECTION = {
  incidents: ["linkedEvidenceIds", "linkedRecordIds"],
  evidence: ["linkedIncidentIds", "linkedRecordIds", "linkedEvidenceIds"],
  documents: ["linkedRecordIds", "basedOnEvidenceIds"],
  ledger: ["linkedRecordIds"],
  strategy: ["linkedRecordIds", "linkedIncidentIds", "linkedEvidenceIds"],
};
const ARRAY_PATCH_FIELDS = [
  "tags",
  "usedIn",
  "linkedRecordIds",
  "linkedIncidentIds",
  "linkedEvidenceIds",
  "basedOnEvidenceIds",
  "linkedIncidentRefs",
];
const BINARY_CREATE_FIELDS = [
  "attachments",
  "availability",
  "dataUrl",
  "backupDataUrl",
  "file",
  "files",
  "storage",
];
const TEXT_FIELD_LIMITS = {
  title: 180,
  summary: 1500,
  description: 5000,
  notes: 5000,
  textContent: 10000,
  reviewNotes: 5000,
  functionSummary: 5000,
};
const STRING_FIELDS = new Set([
  "title",
  "summary",
  "description",
  "notes",
  "textContent",
  "reviewNotes",
  "functionSummary",
  "date",
  "eventDate",
  "capturedAt",
  "source",
  "sequenceGroup",
  "category",
  "documentDate",
  "subType",
  "label",
  "period",
  "currency",
  "dueDate",
  "paymentDate",
  "status",
  "method",
  "reference",
  "counterparty",
  "proofType",
  "proofStatus",
  "batchLabel",
  "importance",
  "evidenceStatus",
  "relevance",
  "sourceType",
  "evidenceRole",
  "evidenceType",
  "currentFocus",
]);
const NUMBER_FIELDS = new Set(["expectedAmount", "paidAmount"]);
const BOOLEAN_FIELDS = new Set(["isMilestone", "isTrackingRecord"]);
const ARRAY_FIELDS = new Set([...ARRAY_PATCH_FIELDS]);
const INCIDENT_STATUS_VALUES = ["open", "archived"];
const RECORD_IMPORTANCE_VALUES = ["unreviewed", "critical", "strong", "supporting", "weak"];
const EVIDENCE_STATUS_VALUES = ["verified", "needs_review", "incomplete"];
const EVIDENCE_RELEVANCE_VALUES = ["high", "medium", "low"];
const IMPORTANCE_ALIAS_VALUES = {
  high: "strong",
  medium: "supporting",
  low: "weak",
  severe: "critical",
  major: "strong",
  minor: "weak",
  important: "strong",
};
const EVIDENCE_SOURCE_TYPE_VALUES = [
  "digital",
  "physical",
  "email",
  "message",
  "photo",
  "document",
  "witness",
  "other",
];
const LEDGER_CATEGORY_VALUES = ["rent", "installment", "deposit", "furniture", "repair", "utility", "legal", "other"];
const LEDGER_STATUS_VALUES = ["planned", "paid", "part-paid", "unpaid", "disputed", "refunded"];
const LEDGER_METHOD_VALUES = ["bank_transfer", "cash", "card", "direct_debit", "standing_order", "paypal", "other"];
const LEDGER_SUBTYPE_VALUES = [
  "rent",
  "arrears",
  "installment",
  "deposit",
  "repair",
  "utility",
  "legal",
  "fee",
  "refund",
  "income",
  "credit",
  "expense",
  "debit",
  "other",
];
const LEDGER_PROOF_TYPE_VALUES = [
  "receipt",
  "invoice",
  "bank_statement",
  "transfer_record",
  "payment_confirmation",
  "contract",
  "statement",
  "message",
  "email",
  "photo",
  "document",
  "other",
];
const LEDGER_PROOF_STATUS_VALUES = ["missing", "partial", "confirmed"];
const ENUM_VALUES_BY_SECTION = {
  incidents: {
    status: INCIDENT_STATUS_VALUES,
    importance: RECORD_IMPORTANCE_VALUES,
    evidenceStatus: [...INCIDENT_EVIDENCE_STATUSES, "supported"],
  },
  evidence: {
    status: EVIDENCE_STATUS_VALUES,
    importance: RECORD_IMPORTANCE_VALUES,
    relevance: EVIDENCE_RELEVANCE_VALUES,
    sourceType: EVIDENCE_SOURCE_TYPE_VALUES,
    evidenceRole: EVIDENCE_ROLES,
    evidenceType: EVIDENCE_TYPES,
  },
  ledger: {
    category: LEDGER_CATEGORY_VALUES,
    subType: LEDGER_SUBTYPE_VALUES,
    status: LEDGER_STATUS_VALUES,
    method: LEDGER_METHOD_VALUES,
    proofType: LEDGER_PROOF_TYPE_VALUES,
    proofStatus: LEDGER_PROOF_STATUS_VALUES,
  },
  strategy: {
    status: INCIDENT_STATUS_VALUES,
  },
};

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

function sanitizePreviewText(value) {
  const text = String(value ?? "").normalize("NFC");
  return text
    .replaceAll("Ã¢â‚¬â€", "-")
    .replaceAll("Ã¢â‚¬â€œ", "-")
    .replaceAll("â€”", "-")
    .replaceAll("â€“", "-")
    .replaceAll("â€™", "'")
    .replaceAll("â€˜", "'")
    .replaceAll("â€œ", "\"")
    .replaceAll("â€", "\"")
    .replaceAll("Â", "")
    .replace(/\uFFFD/g, "");
}

function levenshteinDistance(a = "", b = "") {
  const left = String(a).toLowerCase();
  const right = String(b).toLowerCase();
  const matrix = Array.from({ length: left.length + 1 }, (_, row) => [row]);

  for (let column = 1; column <= right.length; column += 1) {
    matrix[0][column] = column;
  }

  for (let row = 1; row <= left.length; row += 1) {
    for (let column = 1; column <= right.length; column += 1) {
      const cost = left[row - 1] === right[column - 1] ? 0 : 1;
      matrix[row][column] = Math.min(
        matrix[row - 1][column] + 1,
        matrix[row][column - 1] + 1,
        matrix[row - 1][column - 1] + cost
      );
    }
  }

  return matrix[left.length][right.length];
}

function getClosestEnumSuggestion(value, validValues = []) {
  const normalized = String(value || "").trim();
  if (!normalized || validValues.length === 0) return "";

  const ranked = validValues
    .map((candidate) => ({
      candidate,
      distance: levenshteinDistance(normalized, candidate),
    }))
    .sort((a, b) => a.distance - b.distance);

  const best = ranked[0];
  if (!best) return "";
  return best.distance <= Math.max(2, Math.floor(String(best.candidate).length / 3)) ? best.candidate : "";
}

function getEnumValues(section, field) {
  return ENUM_VALUES_BY_SECTION[section]?.[field] || null;
}

function validateGptDeltaFieldValue(section, field, value, contextLabel) {
  // Text length limits stop GPT from injecting oversized content into patch/create previews or saved records.
  if (Object.prototype.hasOwnProperty.call(TEXT_FIELD_LIMITS, field)) {
    if (typeof value !== "string") {
      return `${contextLabel}.${field} must be a string.`;
    }
    if (value.length > TEXT_FIELD_LIMITS[field]) {
      return `${contextLabel}.${field} exceeds ${TEXT_FIELD_LIMITS[field]} characters.`;
    }
  }

  // Scalar type checks reject values before domain normalization could silently coerce them.
  if (STRING_FIELDS.has(field) && value != null && typeof value !== "string") {
    return `${contextLabel}.${field} must be a string.`;
  }

  if (NUMBER_FIELDS.has(field) && (typeof value !== "number" || !Number.isFinite(value))) {
    return `${contextLabel}.${field} must be a finite number.`;
  }

  if (BOOLEAN_FIELDS.has(field) && typeof value !== "boolean") {
    return `${contextLabel}.${field} must be a boolean.`;
  }

  if (ARRAY_FIELDS.has(field) && !Array.isArray(value)) {
    return `${contextLabel}.${field} must be an array.`;
  }

  // Enum validation is limited to app vocabularies that already exist in the case domain/UI.
  const enumValues = getEnumValues(section, field);
  if (enumValues && value != null && value !== "" && !enumValues.includes(value)) {
    const suggestion = getClosestEnumSuggestion(value, enumValues);
    return `${contextLabel}.${field} has unsupported value "${value}". Valid values: ${listFields(enumValues)}.${suggestion ? ` Did you mean "${suggestion}"?` : ""}`;
  }

  return "";
}

function validateGptDeltaFields(section, source = {}, contextLabel = section) {
  for (const [field, value] of Object.entries(source || {})) {
    const fieldError = validateGptDeltaFieldValue(section, field, value, contextLabel);
    if (fieldError) return fieldError;
  }
  return "";
}

function normalizeGptImportanceAlias(section, source = {}, contextLabel = section) {
  const allowlist = CREATE_FIELD_ALLOWLISTS[section] || PATCH_FIELD_ALLOWLISTS[section] || [];
  if (!allowlist.includes("importance") || !Object.prototype.hasOwnProperty.call(source, "importance")) {
    return { source, warnings: [] };
  }

  const value = source.importance;
  if (typeof value !== "string") return { source, warnings: [] };

  const normalized = value.trim().toLowerCase();
  const canonical = RECORD_IMPORTANCE_VALUES.includes(normalized)
    ? normalized
    : IMPORTANCE_ALIAS_VALUES[normalized];
  if (!canonical || canonical === value) return { source, warnings: [] };

  return {
    source: {
      ...source,
      importance: canonical,
    },
    warnings: [`Normalized ${contextLabel}.importance from "${value}" to "${canonical}".`],
  };
}

function validateActionSummaryPatchFields(actionSummaryPatch = {}) {
  if (Object.prototype.hasOwnProperty.call(actionSummaryPatch, "currentFocus") && typeof actionSummaryPatch.currentFocus !== "string") {
    return "actionSummary.currentFocus must be a string.";
  }

  for (const field of ACTION_SUMMARY_LIST_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(actionSummaryPatch, field)) continue;
    if (!Array.isArray(actionSummaryPatch[field])) {
      return `actionSummary.${field} must be an array.`;
    }
    const invalidItems = actionSummaryPatch[field].filter((item) => typeof item !== "string");
    if (invalidItems.length > 0) {
      return `actionSummary.${field} must contain only strings.`;
    }
  }

  return "";
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

function normalizeDuplicateTitle(value) {
  return safeText(value)
    .toLowerCase()
    .replace(/[.,/#!$%^&*;:{}=\-_`~()[\]"'?]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeDuplicateDate(source = {}) {
  const raw = safeText(source.eventDate || source.date || source.capturedAt).trim();
  if (!raw) return "";
  const isoDate = raw.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  if (isoDate) return isoDate;

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().split("T")[0];
  }
  return raw;
}

function hasSimilarDuplicateTitle(left, right) {
  if (!left || !right || left === right) return false;
  const shortest = Math.min(left.length, right.length);
  if (shortest < 12) return false;

  const distance = levenshteinDistance(left, right);
  const threshold = Math.max(2, Math.floor(shortest * 0.15));
  return distance <= threshold;
}

function getDuplicateCreateWarnings(caseItem, section, item = {}, title = "") {
  if (!["incidents", "evidence"].includes(section)) return [];

  const newTitle = normalizeDuplicateTitle(title);
  const newDate = normalizeDuplicateDate(item);
  if (!newTitle || !newDate) return [];

  const recordType = section === "incidents" ? "incident" : "evidence";
  const existingRecords = Array.isArray(caseItem?.[section]) ? caseItem[section] : [];
  const warnings = [];

  for (const record of existingRecords) {
    const existingTitle = normalizeDuplicateTitle(record?.title);
    const existingDate = normalizeDuplicateDate(record);
    if (!existingTitle || !existingDate || existingDate !== newDate) continue;

    const isDuplicateRisk = existingTitle === newTitle || hasSimilarDuplicateTitle(newTitle, existingTitle);
    if (!isDuplicateRisk) continue;

    warnings.push(
      `Possible duplicate ${recordType} create: '${title}' matches existing ${recordType} '${record?.title || "Untitled"}' on ${newDate} (id: ${record?.id || "unknown"}). Consider patching the existing record instead.`
    );
  }

  return warnings;
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

function collectPatchItems(patch = {}) {
  return SUPPORTED_V2_PATCH_SECTIONS.flatMap((section) =>
    (Array.isArray(patch?.[section]) ? patch[section] : []).map((item, index) => ({
      section,
      index,
      item,
    }))
  );
}

function getCaseRecord(caseItem, section, id) {
  return (Array.isArray(caseItem?.[section]) ? caseItem[section] : [])
    .find((record) => String(record?.id || "") === String(id || ""));
}

function getRecordTitle(record = {}, section = "") {
  if (section === "ledger") return record.label || "Untitled ledger";
  return record.title || `Untitled ${mapSectionToRecordType(section)}`;
}

function getTargetSectionForLinkField(field) {
  if (field === "linkedIncidentIds") return "incidents";
  if (field === "linkedEvidenceIds" || field === "basedOnEvidenceIds") return "evidence";
  return "";
}

function buildIdValidationContext(caseItem, tempIdMap = new Map(), tempIdSections = new Map()) {
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

  return { validIds, validTempIds, isValidTypedLink };
}

function validateLinkedIdsForItem(section, title, source, linkFields, validationContext) {
  // ID validation rejects links unless they point to canonical case records or temp IDs declared in this delta.
  for (const field of linkFields) {
    if (!Object.prototype.hasOwnProperty.call(source, field)) continue;
    if (!Array.isArray(source[field])) {
      return `${section}.${title} field ${field} must be an array.`;
    }
    const targetSection = getTargetSectionForLinkField(field);
    const invalidIds = source[field].filter((id) => {
      const key = String(id || "");
      if (!key) return true;
      if (targetSection) return !validationContext.isValidTypedLink(key, targetSection);
      return !validationContext.validIds.has(key) && !validationContext.validTempIds.has(key);
    });
    if (invalidIds.length > 0) {
      return `${section}.${title} has unknown ${field}: ${listFields(invalidIds)}.`;
    }
  }
  return "";
}

function resolvePatch(patch = {}, tempIdMap = new Map()) {
  return Object.entries(patch).reduce((normalized, [field, value]) => {
    if (["linkedRecordIds", "linkedIncidentIds", "linkedEvidenceIds", "basedOnEvidenceIds"].includes(field)) {
      normalized[field] = resolveIdList(value, tempIdMap);
      return normalized;
    }

    if (field === "linkedIncidentRefs") {
      normalized[field] = Array.isArray(value)
        ? value.map((ref) => ({
            ...ref,
            incidentId: resolveId(ref?.incidentId, tempIdMap),
          }))
        : [];
      return normalized;
    }

    normalized[field] = value;
    return normalized;
  }, {});
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

    const strategyFieldError = validateGptDeltaFields("strategy", item.patch, `strategy.patch ${item.id}`);
    if (strategyFieldError) return { ok: false, reason: strategyFieldError };

    const patch = STRATEGY_PATCHABLE_FIELDS.reduce((normalized, field) => {
      if (!Object.prototype.hasOwnProperty.call(item.patch, field)) return normalized;

      normalized[field] = item.patch[field];
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

    const normalizedImportance = normalizeGptImportanceAlias(section, item, `${section}.create item ${index + 1}`);
    const normalizedItem = normalizedImportance.source;
    warnings.push(...normalizedImportance.warnings);

    const fieldError = validateGptDeltaFields(section, normalizedItem, `${section}.create item ${index + 1}`);
    if (fieldError) return { ok: false, reason: fieldError };

    const title = getCreateTitle(section, normalizedItem);
    if (!title) {
      return { ok: false, reason: `${section}.create item ${index + 1} requires ${section === "ledger" ? "label" : "title"}.` };
    }

    if (normalizedItem.tempId != null && typeof normalizedItem.tempId !== "string") {
      return { ok: false, reason: `${section}.create item ${title} has a non-string tempId.` };
    }

    const tempId = safeText(normalizedItem.tempId).trim();
    const finalId = generateId();
    if (tempId) {
      if (tempIdMap.has(tempId)) {
        return { ok: false, reason: `Duplicate GPT temporary id in create operations: ${tempId}.` };
      }
      tempIdMap.set(tempId, finalId);
      tempIdSections.set(tempId, section);
    }

    if (section === "documents" && normalizedItem.isTrackingRecord && !safeText(normalizedItem.textContent).includes("[TRACK RECORD]")) {
      warnings.push(`documents.create ${title} has isTrackingRecord=true but textContent does not contain [TRACK RECORD]; it will be saved as a normal document.`);
    }

    warnings.push(...getDuplicateCreateWarnings(caseItem, section, normalizedItem, title));

    plannedCreates.push({ section, index, item: normalizedItem, tempId, finalId, title });
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

export function normalizeGptV2Delta(caseItem, payload = {}) {
  const target = validateGptDeltaTarget(caseItem, payload, ["gpt-delta-2.0"]);
  if (!target.ok) return target;

  const operations = payload.operations;
  if (!operations || typeof operations !== "object" || Array.isArray(operations)) {
    return { ok: false, reason: "GPT delta operations are required for gpt-delta-2.0." };
  }

  const create = operations.create;
  const patch = operations.patch;
  const hasCreate = create && typeof create === "object" && !Array.isArray(create);
  const hasPatch = patch && typeof patch === "object" && !Array.isArray(patch);

  if (!hasCreate && !hasPatch) {
    return { ok: false, reason: "gpt-delta-2.0 requires operations.create or operations.patch." };
  }

  let plannedCreates = [];
  let tempIdMap = new Map();
  let tempIdSections = new Map();
  const warnings = [];

  if (Object.prototype.hasOwnProperty.call(operations, "create") && hasCreate && Object.keys(create).length > 0) {
    const createResult = normalizeGptCreateDelta(caseItem, {
      ...payload,
      operations: { create },
    });
    if (!createResult.ok) return createResult;
    plannedCreates = createResult.plannedCreates;
    tempIdMap = createResult.tempIdMap;
    warnings.push(...(createResult.warnings || []));

    plannedCreates.forEach((planned) => {
      if (planned.tempId) tempIdSections.set(planned.tempId, planned.section);
    });
  } else if (Object.prototype.hasOwnProperty.call(operations, "create")) {
    if (!hasCreate) {
      return { ok: false, reason: "GPT delta operations.create must be an object for gpt-delta-2.0." };
    }
  }

  if (!Object.prototype.hasOwnProperty.call(operations, "patch")) {
    return { ok: true, caseId: target.caseId, plannedCreates, plannedPatches: [], tempIdMap, warnings };
  }

  if (!hasPatch) {
    return { ok: false, reason: "GPT delta operations.patch must be an object for gpt-delta-2.0." };
  }

  const unsupportedSections = Object.keys(patch).filter((section) => !SUPPORTED_V2_PATCH_SECTIONS.includes(section));
  if (unsupportedSections.length > 0) {
    return {
      ok: false,
      reason: `Unsupported gpt-delta-2.0 patch section(s): ${listFields(unsupportedSections)}. Current patch support is incidents, evidence, documents, ledger, and strategy.`,
    };
  }

  for (const section of SUPPORTED_V2_PATCH_SECTIONS) {
    if (Object.prototype.hasOwnProperty.call(patch, section) && !Array.isArray(patch[section])) {
      return { ok: false, reason: `GPT delta ${section}.patch must be an array.` };
    }
  }

  const allPatchItems = collectPatchItems(patch);
  if (allPatchItems.length === 0 && plannedCreates.length === 0) {
    return { ok: false, reason: "GPT delta operation has no supported records to create or patch." };
  }

  const validationContext = buildIdValidationContext(caseItem, tempIdMap, tempIdSections);
  const plannedPatches = [];
  const seenPatchIds = new Set();

  for (const { section, index, item } of allPatchItems) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return { ok: false, reason: `Each ${section}.patch item must be an object.` };
    }

    if (typeof item.id !== "string" || !item.id.trim()) {
      return { ok: false, reason: `${section}.patch item ${index + 1} must include an existing id.` };
    }

    const recordId = item.id.trim();
    const duplicateKey = `${section}:${recordId}`;
    if (seenPatchIds.has(duplicateKey)) {
      return { ok: false, reason: `Duplicate ${section}.patch id: ${recordId}` };
    }
    seenPatchIds.add(duplicateKey);

    const existingRecord = getCaseRecord(caseItem, section, recordId);
    if (!existingRecord) {
      return { ok: false, reason: `${section}.patch references unknown record id: ${recordId}.` };
    }

    if (!item.patch || typeof item.patch !== "object" || Array.isArray(item.patch)) {
      return { ok: false, reason: `${section}.patch ${recordId} must include a patch object.` };
    }

    const binaryFields = hasBinaryCreateField(item.patch);
    if (binaryFields.length > 0) {
      return { ok: false, reason: `${section}.patch ${recordId} does not support binary or attachment field(s): ${listFields(binaryFields)}.` };
    }

    const unsupportedFields = Object.keys(item.patch).filter((field) => !PATCH_FIELD_ALLOWLISTS[section].includes(field));
    if (unsupportedFields.length > 0) {
      return { ok: false, reason: `${section}.patch ${recordId} has unsupported field(s): ${listFields(unsupportedFields)}.` };
    }

    if (Object.keys(item.patch).length === 0) {
      return { ok: false, reason: `${section}.patch ${recordId} must include at least one supported field.` };
    }

    const normalizedImportance = normalizeGptImportanceAlias(section, item.patch, `${section}.patch ${recordId}`);
    const normalizedPatch = normalizedImportance.source;
    warnings.push(...normalizedImportance.warnings);

    const fieldError = validateGptDeltaFields(section, normalizedPatch, `${section}.patch ${recordId}`);
    if (fieldError) return { ok: false, reason: fieldError };

    const invalidArrayFields = Object.keys(normalizedPatch).filter((field) =>
      ARRAY_PATCH_FIELDS.includes(field) && !Array.isArray(normalizedPatch[field])
    );
    if (invalidArrayFields.length > 0) {
      return { ok: false, reason: `${section}.patch ${recordId} array field(s) must be full replacement arrays: ${listFields(invalidArrayFields)}.` };
    }

    const linkError = validateLinkedIdsForItem(
      section,
      `patch ${recordId}`,
      normalizedPatch,
      LINK_FIELDS_BY_PATCH_SECTION[section] || [],
      validationContext
    );
    if (linkError) return { ok: false, reason: linkError };

    if (Array.isArray(normalizedPatch.linkedIncidentRefs)) {
      const invalidRefs = normalizedPatch.linkedIncidentRefs.filter((ref) => {
        const incidentId = String(ref?.incidentId || "");
        return !validationContext.isValidTypedLink(incidentId, "incidents");
      });
      if (invalidRefs.length > 0) {
        return { ok: false, reason: `${section}.patch ${recordId} has unknown linkedIncidentRefs incidentId.` };
      }
    }

    plannedPatches.push({
      section,
      id: recordId,
      patch: normalizedPatch,
      title: getRecordTitle(existingRecord, section),
    });
  }

  return { ok: true, caseId: target.caseId, plannedCreates, plannedPatches, tempIdMap, warnings };
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

  const actionSummaryFieldError = validateActionSummaryPatchFields(actionSummaryPatch);
  if (actionSummaryFieldError) return { ok: false, reason: actionSummaryFieldError };

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

function applyNormalizedGptCreates(caseItem, normalized) {
  let updatedCase = caseItem;
  const createdRecords = [];
  const createdSyncRecords = [];
  const warnings = [...(normalized.warnings || [])];

  for (const planned of normalized.plannedCreates || []) {
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

  const tempIdMappings = [...(normalized.tempIdMap || new Map()).entries()].map(([tempId, finalId]) => ({
    tempId,
    finalId,
  }));

  return { case: updatedCase, warnings, createdRecords, tempIdMappings };
}

function applyGptRecordPatch(updatedCase, planned, tempIdMap) {
  const currentRecord = getCaseRecord(updatedCase, planned.section, planned.id);
  if (!currentRecord) return { case: updatedCase, record: null };

  const resolvedPatch = resolvePatch(planned.patch, tempIdMap);

  if (["incidents", "evidence", "strategy"].includes(planned.section)) {
    const input = {
      ...currentRecord,
      ...resolvedPatch,
      id: currentRecord.id,
      createdAt: currentRecord.createdAt,
      attachments: currentRecord.attachments || [],
      availability: currentRecord.availability || defaultEvidenceAvailability(),
    };
    const nextCase = upsertRecordInCase(updatedCase, planned.section, input, currentRecord);
    return { case: nextCase, record: getCaseRecord(nextCase, planned.section, planned.id) };
  }

  if (planned.section === "documents") {
    const input = {
      ...currentRecord,
      ...resolvedPatch,
      id: currentRecord.id,
      createdAt: currentRecord.createdAt,
      attachments: currentRecord.attachments || [],
    };
    const nextCase = upsertDocumentEntryInCase(updatedCase, input, planned.id);
    return { case: nextCase, record: getCaseRecord(nextCase, planned.section, planned.id) };
  }

  const input = {
    ...currentRecord,
    ...resolvedPatch,
    id: currentRecord.id,
    createdAt: currentRecord.createdAt,
  };
  const nextCase = upsertLedgerEntryInCase(updatedCase, input, planned.id);
  return { case: nextCase, record: getCaseRecord(nextCase, planned.section, planned.id) };
}

export function ingestGptV2Delta(caseItem, payload) {
  const normalized = normalizeGptV2Delta(caseItem, payload);
  if (!normalized.ok) return normalized;

  const createResult = applyNormalizedGptCreates(caseItem, normalized);
  let updatedCase = createResult.case;
  const patchedRecords = [];

  for (const planned of normalized.plannedPatches || []) {
    const patchResult = applyGptRecordPatch(updatedCase, planned, normalized.tempIdMap);
    updatedCase = patchResult.case;
    if (patchResult.record) {
      patchedRecords.push({
        id: planned.id,
        recordType: mapSectionToRecordType(planned.section),
        section: planned.section,
        title: getRecordTitle(patchResult.record, planned.section),
        fields: Object.keys(planned.patch),
      });
    }
  }

  return {
    ok: true,
    case: updatedCase,
    warnings: createResult.warnings,
    createdRecords: createResult.createdRecords,
    tempIdMappings: createResult.tempIdMappings,
    patchedRecords,
  };
}

export function ingestGptDelta(caseItem, payload) {
  if (getPayloadContractVersion(payload) === "gpt-delta-2.0") {
    return ingestGptV2Delta(caseItem, payload);
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
  // Preview sanitation keeps invalid/mojibake characters out of the modal without changing saved case data.
  if (Array.isArray(value)) return sanitizePreviewText(value.join("\n"));
  if (value == null) return "";
  if (typeof value === "object") return sanitizePreviewText(JSON.stringify(value));
  return sanitizePreviewText(value);
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
  const contractVersion = getPayloadContractVersion(payload) || "";
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

  const strategyItems = contractVersion !== "gpt-delta-2.0" && Array.isArray(patch.strategy)
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

  const patchedRecords = contractVersion === "gpt-delta-2.0"
    ? SUPPORTED_V2_PATCH_SECTIONS.flatMap((section) =>
        (Array.isArray(patch?.[section]) ? patch[section] : [])
          .map((item) => {
            const recordId = typeof item?.id === "string" ? item.id.trim() : "";
            const currentRecord = getCaseRecord(currentCase, section, recordId);
            const updatedRecord = getCaseRecord(updatedCase, section, recordId);
            const patchedFields = item?.patch && typeof item.patch === "object" && !Array.isArray(item.patch)
              ? PATCH_FIELD_ALLOWLISTS[section].filter((field) => Object.prototype.hasOwnProperty.call(item.patch, field))
              : [];
            return {
              id: recordId,
              recordType: mapSectionToRecordType(section),
              section,
              title: getRecordTitle(updatedRecord || currentRecord, section),
              changes: buildFieldChanges(patchedFields, currentRecord || {}, updatedRecord || {}),
            };
          })
          .filter((item) => item.id)
      )
    : [];

  if (patchedRecords.length > 0) {
    const patchSections = SUPPORTED_V2_PATCH_SECTIONS.filter((section) =>
      Array.isArray(patch?.[section]) && patch[section].length > 0
    );
    supportedSections.push(...patchSections.map((section) => `${section}.patch`));
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
    contractVersion,
    supportedSections,
    actionSummaryFields,
    actionSummaryChanges,
    strategyItems,
    patchedRecords,
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
