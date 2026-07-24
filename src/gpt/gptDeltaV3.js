import { normalizeCase, normalizeRecord, normalizeWatchItem, WATCH_CATEGORIES, WATCH_PRIORITIES, WATCH_STATUSES } from "../domain/caseDomain.js";

export const GPT_DELTA_V3 = "gpt-delta-3.0";
export const STRATEGY_V3_FIELDS = ["title", "date", "eventDate", "description", "notes", "status", "tags", "source", "sequenceGroup", "linkedRecordIds", "linkedIncidentIds", "linkedEvidenceIds", "strategySchemaVersion", "strategyType", "objective", "rationale", "desiredOutcome", "priority", "reviewDate", "decisionStatus", "ownerPartyId", "assumptions", "risks", "nextSteps"];
export const WATCH_V3_FIELDS = ["title", "category", "status", "priority", "date", "eventDate", "reviewDate", "watchFor", "rationale", "triggerConditions", "latestObservation", "nextCheck", "outcome", "linkedRecordIds", "linkedPartyIds", "sequenceGroup", "tags", "source"];
const WATCH_CREATE_FIELDS = WATCH_V3_FIELDS.filter((field) => !["eventDate", "source"].includes(field));
const STRING_LIST_FIELDS = new Set(["tags", "linkedRecordIds", "linkedIncidentIds", "linkedEvidenceIds", "linkedPartyIds", "assumptions", "risks", "nextSteps", "triggerConditions"]);
const DATE_FIELDS = new Set(["date", "eventDate", "reviewDate"]);
const STRATEGY_TYPES = ["", "objective", "argument", "action", "risk", "decision", "question"];
const STRATEGY_PRIORITIES = ["", "low", "medium", "high", "critical"];
const DECISION_STATUSES = ["", "proposed", "approved", "rejected", "completed"];
const STRATEGY_STATUSES = ["open", "archived"];

function strictDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number); const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}
const text = (value) => typeof value === "string" ? value.trim() : "";
const list = (value) => [...new Set(value.map((item) => item.trim()).filter(Boolean))];

function recordIds(caseItem) {
  return new Set(["incidents", "evidence", "documents", "ledger", "strategy", "watchItems", "tasks"].flatMap((key) => (caseItem[key] || []).map((item) => item?.id).filter(Boolean)));
}

function validateFields(source, allowed, label) {
  if (!source || typeof source !== "object" || Array.isArray(source)) return `${label} must be an object.`;
  const unknown = Object.keys(source).filter((field) => !allowed.includes(field));
  if (unknown.length) return `${label} has unsupported field(s): ${unknown.join(", ")}.`;
  for (const [field, value] of Object.entries(source)) {
    if (STRING_LIST_FIELDS.has(field)) {
      if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) return `${label}.${field} must be an array containing only strings.`;
    } else if (field === "strategySchemaVersion") {
      if (value !== 3) return `${label}.strategySchemaVersion must equal 3.`;
    } else if (typeof value !== "string") return `${label}.${field} must be a string.`;
    if (DATE_FIELDS.has(field) && value !== "" && !strictDate(value)) return `${label}.${field} must use a valid YYYY-MM-DD calendar date.`;
  }
  return "";
}

function cleanFields(source) {
  return Object.fromEntries(Object.entries(source).map(([field, value]) => [field, STRING_LIST_FIELDS.has(field) ? list(value) : typeof value === "string" ? value.trim() : value]));
}

function validateEnums(source, kind, label) {
  const definitions = kind === "strategy" ? { strategyType: STRATEGY_TYPES, priority: STRATEGY_PRIORITIES, decisionStatus: DECISION_STATUSES, status: STRATEGY_STATUSES } : { category: ["", ...WATCH_CATEGORIES], priority: ["", ...WATCH_PRIORITIES], status: WATCH_STATUSES };
  for (const [field, values] of Object.entries(definitions)) if (Object.hasOwn(source, field) && !values.includes(source[field])) return `${label}.${field} has unsupported value "${source[field]}".`;
  return "";
}

function validateLinks(source, caseItem, label) {
  const ids = recordIds(caseItem); const parties = new Set((caseItem.parties || []).map((item) => item?.id).filter(Boolean));
  const typedIds = { linkedRecordIds: ids, linkedIncidentIds: new Set((caseItem.incidents || []).map((item) => item?.id).filter(Boolean)), linkedEvidenceIds: new Set((caseItem.evidence || []).map((item) => item?.id).filter(Boolean)) };
  for (const [field, validIds] of Object.entries(typedIds)) if (Object.hasOwn(source, field)) {
    const invalid = source[field].filter((id) => !validIds.has(id)); if (invalid.length) return `${label}.${field} contains unknown or incompatible id(s): ${invalid.join(", ")}.`;
  }
  if (Object.hasOwn(source, "linkedPartyIds")) { const invalid = source.linkedPartyIds.filter((id) => !parties.has(id)); if (invalid.length) return `${label}.linkedPartyIds contains unknown party id(s): ${invalid.join(", ")}.`; }
  if (Object.hasOwn(source, "ownerPartyId") && source.ownerPartyId && !parties.has(source.ownerPartyId)) return `${label}.ownerPartyId must be empty or identify an existing party.`;
  return "";
}

export function validateGptDeltaV3(caseItem, payload = {}) {
  if (!caseItem || payload?.app !== "proveit" || text(payload.contractVersion) !== GPT_DELTA_V3) return { ok: false, reason: "Unsupported GPT delta contract." };
  if (text(payload.target?.caseId) !== String(caseItem.id || "")) return { ok: false, reason: "GPT delta target case does not match the provided case." };
  const operations = payload.operations;
  if (!operations || typeof operations !== "object" || Array.isArray(operations)) return { ok: false, reason: "gpt-delta-3.0 operations must be an object." };
  const unsupportedGroups = Object.keys(operations).filter((key) => !["create", "patch", "append"].includes(key));
  if (unsupportedGroups.length) return { ok: false, reason: `Unsupported gpt-delta-3.0 operation group(s): ${unsupportedGroups.join(", ")}.` };
  const allowedSections = { create: ["watchItems"], patch: ["strategy", "watchItems"], append: ["watchObservations"] };
  for (const [group, sections] of Object.entries(operations)) {
    if (!sections || typeof sections !== "object" || Array.isArray(sections)) return { ok: false, reason: `operations.${group} must be an object.` };
    const unknown = Object.keys(sections).filter((key) => !allowedSections[group].includes(key));
    if (unknown.length) return { ok: false, reason: `Unsupported gpt-delta-3.0 ${group} section(s): ${unknown.join(", ")}.` };
    for (const key of Object.keys(sections)) if (!Array.isArray(sections[key])) return { ok: false, reason: `operations.${group}.${key} must be an array.` };
  }
  const creates = operations.create?.watchItems || []; const strategyPatches = operations.patch?.strategy || []; const watchPatches = operations.patch?.watchItems || []; const appends = operations.append?.watchObservations || [];
  if (!creates.length && !strategyPatches.length && !watchPatches.length && !appends.length) return { ok: false, reason: "gpt-delta-3.0 has no supported operations." };
  const planned = { creates: [], strategyPatches: [], watchPatches: [], appends: [] }; const seen = new Set(); const clientIds = new Set(); const duplicateObservations = new Set();
  for (const [index, entry] of creates.entries()) {
    const label = `watchItems.create item ${index + 1}`;
    if (!entry || typeof entry !== "object" || Array.isArray(entry) || Object.keys(entry).some((key) => !["clientId", "record"].includes(key)) || typeof entry.clientId !== "string" || !entry.clientId.trim() || !entry.record) return { ok: false, reason: `${label} requires only clientId and record.` };
    if (clientIds.has(entry.clientId.trim())) return { ok: false, reason: `Duplicate watchItems.create clientId: ${entry.clientId.trim()}.` }; clientIds.add(entry.clientId.trim());
    let error = validateFields(entry.record, WATCH_CREATE_FIELDS, label) || validateEnums(entry.record, "watch", label) || validateLinks(entry.record, caseItem, label); if (error) return { ok: false, reason: error };
    const record = cleanFields(entry.record); if (!record.title) return { ok: false, reason: `${label}.title is required.` };
    planned.creates.push({ clientId: entry.clientId.trim(), record });
  }
  for (const [kind, entries, collection, allowed] of [["strategy", strategyPatches, "strategy", STRATEGY_V3_FIELDS], ["watchItems", watchPatches, "watchItems", WATCH_V3_FIELDS]]) for (const [index, entry] of entries.entries()) {
    const label = `${kind}.patch item ${index + 1}`; if (!entry || typeof entry !== "object" || Array.isArray(entry) || Object.keys(entry).some((key) => !["id", "patch"].includes(key)) || !text(entry.id) || !entry.patch) return { ok: false, reason: `${label} requires only an existing id and patch object.` };
    const id = text(entry.id); if (seen.has(`${kind}:${id}`)) return { ok: false, reason: `Duplicate ${kind}.patch id: ${id}.` }; seen.add(`${kind}:${id}`);
    if (!(caseItem[collection] || []).some((item) => item.id === id)) return { ok: false, reason: `${kind}.patch references unknown record id: ${id}.` };
    let error = validateFields(entry.patch, allowed, label) || validateEnums(entry.patch, kind === "strategy" ? "strategy" : "watch", label) || validateLinks(entry.patch, caseItem, label); if (error) return { ok: false, reason: error };
    if (!Object.keys(entry.patch).length) return { ok: false, reason: `${label}.patch must contain at least one supported field.` };
    planned[kind === "strategy" ? "strategyPatches" : "watchPatches"].push({ id, patch: cleanFields(entry.patch) });
  }
  for (const [index, entry] of appends.entries()) {
    const label = `watchObservations.append item ${index + 1}`; if (!entry || typeof entry !== "object" || Array.isArray(entry) || Object.keys(entry).some((key) => !["watchItemId", "observation"].includes(key))) return { ok: false, reason: `${label} has an invalid shape.` };
    const watchItemId = text(entry.watchItemId); if (!(caseItem.watchItems || []).some((item) => item.id === watchItemId)) return { ok: false, reason: `${label} references an unknown watch item.` };
    const observation = entry.observation; if (!observation || typeof observation !== "object" || Array.isArray(observation) || Object.keys(observation).some((key) => !["date", "text"].includes(key))) return { ok: false, reason: `${label}.observation supports only date and text.` };
    if (!strictDate(observation.date)) return { ok: false, reason: `${label}.observation.date must use a valid YYYY-MM-DD calendar date.` }; const observationText = text(observation.text); if (!observationText) return { ok: false, reason: `${label}.observation.text is required.` };
    const key = `${watchItemId}\u0000${observation.date}\u0000${observationText.toLowerCase()}`; if (duplicateObservations.has(key)) return { ok: false, reason: `${label} duplicates another observation in this delta.` }; duplicateObservations.add(key);
    planned.appends.push({ watchItemId, observation: { date: observation.date, text: observationText } });
  }
  return { ok: true, planned };
}

export function ingestGptV3Delta(caseItem, payload) {
  const validation = validateGptDeltaV3(caseItem, payload); if (!validation.ok) return validation;
  const now = new Date().toISOString(); let working = { ...caseItem, watchItems: [...(caseItem.watchItems || [])], strategy: [...(caseItem.strategy || [])] }; const clientIdMappings = [];
  for (const item of validation.planned.creates) { const record = normalizeWatchItem({ ...item.record, eventDate: item.record.date, source: "gpt-delta-3.0", createdAt: now, updatedAt: now }); working.watchItems.push(record); clientIdMappings.push({ clientId: item.clientId, finalId: record.id }); }
  for (const item of validation.planned.strategyPatches) working.strategy = working.strategy.map((record) => record.id === item.id ? normalizeRecord({ ...record, ...item.patch, id: record.id, createdAt: record.createdAt, attachments: record.attachments || [], updatedAt: now }, "strategy") : record);
  for (const item of validation.planned.watchPatches) working.watchItems = working.watchItems.map((record) => { if (record.id !== item.id) return record; const patch = { ...item.patch }; if (Object.hasOwn(patch, "date")) patch.eventDate = patch.date; else if (Object.hasOwn(patch, "eventDate")) patch.date = patch.eventDate; return normalizeWatchItem({ ...record, ...patch, id: record.id, createdAt: record.createdAt, attachments: record.attachments || [], observations: record.observations || [], updatedAt: now }); });
  for (const item of validation.planned.appends) working.watchItems = working.watchItems.map((record) => record.id === item.watchItemId ? normalizeWatchItem({ ...record, observations: [...(record.observations || []), { date: item.observation.date, text: item.observation.text }], updatedAt: now }) : record);
  const normalizedCase = normalizeCase({ ...working, updatedAt: now });
  return { ok: true, case: normalizedCase, warnings: [], clientIdMappings, summary: { strategiesPatched: validation.planned.strategyPatches.length, watchItemsCreated: validation.planned.creates.length, watchItemsPatched: validation.planned.watchPatches.length, observationsAppended: validation.planned.appends.length } };
}

const previewValue = (value) => Array.isArray(value) ? value.join("\n") : value == null ? "" : String(value);
const changesFor = (fields, before, after) => fields.filter((field) => Object.hasOwn(after, field) && previewValue(before?.[field]) !== previewValue(after?.[field])).map((field) => ({ field, before: previewValue(before?.[field]), after: previewValue(after?.[field]), replacement: STRING_LIST_FIELDS.has(field) }));

export function buildGptV3Preview(payload, currentCase, updatedCase, metadata = {}) {
  const patch = payload.operations?.patch || {}; const create = payload.operations?.create || {}; const append = payload.operations?.append || {};
  const strategyItems = (patch.strategy || []).map((entry) => { const before = (currentCase.strategy || []).find((item) => item.id === entry.id) || {}; const after = (updatedCase.strategy || []).find((item) => item.id === entry.id) || {}; return { id: entry.id, title: after.title || before.title || entry.id, changes: changesFor(STRATEGY_V3_FIELDS, before, after) }; });
  const patchedRecords = (patch.watchItems || []).map((entry) => { const before = (currentCase.watchItems || []).find((item) => item.id === entry.id) || {}; const after = (updatedCase.watchItems || []).find((item) => item.id === entry.id) || {}; return { id: entry.id, recordType: "monitored concern", section: "watchItems", title: after.title || before.title || entry.id, changes: changesFor(WATCH_V3_FIELDS, before, after), escalatedWarning: before.status !== "escalated" && after.status === "escalated" }; });
  const createdRecords = (create.watchItems || []).map((entry) => { const mapping = (metadata.clientIdMappings || []).find((item) => item.clientId === entry.clientId); return { id: mapping?.finalId || entry.clientId, clientId: entry.clientId, recordType: "monitored concern (not an Incident)", title: entry.record?.title || "Untitled monitored concern", category: entry.record?.category || "", priority: entry.record?.priority || "", status: entry.record?.status || "watching", watchFor: entry.record?.watchFor || "", triggerConditions: entry.record?.triggerConditions || [], linkedPartyIds: entry.record?.linkedPartyIds || [], linkedRecordIds: entry.record?.linkedRecordIds || [] }; });
  const observationAppends = (append.watchObservations || []).map((entry) => ({ watchItemId: entry.watchItemId, title: (currentCase.watchItems || []).find((item) => item.id === entry.watchItemId)?.title || entry.watchItemId, date: entry.observation?.date || "", text: entry.observation?.text || "", label: "Append only" }));
  return { caseName: currentCase.name || "Selected case", caseId: String(currentCase.id || ""), contractVersion: GPT_DELTA_V3, supportedSections: [strategyItems.length && "strategy.patch", patchedRecords.length && "watchItems.patch", createdRecords.length && "watchItems.create", observationAppends.length && "watchObservations.append"].filter(Boolean), actionSummaryFields: [], actionSummaryChanges: [], strategyItems, patchedRecords, createdRecords, observationAppends, clientIdMappings: metadata.clientIdMappings || [], tempIdMappings: [], warnings: metadata.warnings || [], resultSummary: metadata.summary || {} };
}
