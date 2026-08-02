export const ISSUE_SCHEMA_VERSION = 1;
export const ISSUE_STATUSES = Object.freeze(["open", "monitoring", "waiting_response", "escalated", "resolved", "archived"]);
export const ISSUE_PRIORITIES = Object.freeze(["low", "normal", "high", "critical"]);
export const ISSUE_RECORD_COLLECTIONS = Object.freeze(["incidents", "evidence", "documents", "ledger", "strategy", "watchItems", "tasks"]);

const text = (value) => typeof value === "string" ? value.trim() : "";
const normalizedName = (value) => text(value).replace(/\s+/g, " ").toLocaleLowerCase();
const list = (value) => Array.isArray(value) ? value : [];
const referenceNumber = (value) => Number(/^ISS-(\d+)$/i.exec(text(value))?.[1] || 0);
const formatReference = (number) => `ISS-${String(number).padStart(3, "0")}`;
const validDate = (value) => !value || /^\d{4}-\d{2}-\d{2}$/.test(value);

function hash(value) {
  let result = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 0x01000193);
  }
  return (result >>> 0).toString(16).padStart(8, "0");
}

function stableIssueId(caseId, reference) {
  return `issue_${hash(`${text(caseId)}:${reference}`)}_${hash(`${reference}:${text(caseId)}`)}`;
}

export function getIssueDisplayLabel(issue) {
  if (!issue) return "Unresolved Issue";
  return [text(issue.reference), text(issue.name)].filter(Boolean).join(" — ") || "Unnamed Issue";
}

export function validateIssue(issue, caseData = {}) {
  const errors = [];
  if (!text(issue?.id)) errors.push("Issue ID is required.");
  if (!/^ISS-\d{3,}$/i.test(text(issue?.reference))) errors.push("Issue reference must use ISS-### format.");
  if (!text(issue?.name)) errors.push("Issue name is required.");
  if (!ISSUE_STATUSES.includes(issue?.status)) errors.push("Issue status is invalid.");
  if (!ISSUE_PRIORITIES.includes(issue?.priority)) errors.push("Issue priority is invalid.");
  if (!validDate(issue?.reviewDate)) errors.push("Issue review date must use YYYY-MM-DD.");
  if (issue?.ownerPartyId && !list(caseData.parties).some((party) => party.id === issue.ownerPartyId)) errors.push("Issue owner does not resolve to a Party.");
  return errors;
}

function normalizeIssueShape(issue, fallback = {}) {
  return {
    id: text(issue?.id) || fallback.id,
    reference: text(issue?.reference).toUpperCase() || fallback.reference,
    name: text(issue?.name) || fallback.name,
    description: typeof issue?.description === "string" ? issue.description.trim() : fallback.description || "",
    purpose: typeof issue?.purpose === "string" ? issue.purpose.trim() : "",
    status: ISSUE_STATUSES.includes(issue?.status) ? issue.status : "open",
    priority: ISSUE_PRIORITIES.includes(issue?.priority) ? issue.priority : "normal",
    ownerPartyId: text(issue?.ownerPartyId) || null,
    reviewDate: validDate(issue?.reviewDate) ? text(issue?.reviewDate) || null : null,
    currentPosition: typeof issue?.currentPosition === "string" ? issue.currentPosition.trim() : "",
    createdAt: text(issue?.createdAt) || fallback.createdAt || "",
    updatedAt: text(issue?.updatedAt) || fallback.updatedAt || text(issue?.createdAt) || fallback.createdAt || "",
  };
}

export function allocateNextIssueReference(caseData = {}) {
  const used = [...list(caseData.issues), ...list(caseData.retiredIssues)].map((issue) => referenceNumber(issue?.reference));
  const retired = list(caseData.retiredIssueReferences).map(referenceNumber);
  const next = Math.max(1, Number(caseData.nextIssueReferenceNumber) || 1, ...used.map((n) => n + 1), ...retired.map((n) => n + 1));
  return { reference: formatReference(next), nextIssueReferenceNumber: next + 1 };
}

export function resolveCaseIssue(caseData = {}, value) {
  const issues = list(caseData.issues);
  const query = typeof value === "object" && value ? value : { value };
  const id = text(query.issueId) || (text(query.value).startsWith("issue_") ? text(query.value) : "");
  if (id) return issues.find((issue) => issue.id === id) || null;
  const reference = text(query.issueReference) || (/^ISS-\d+$/i.test(text(query.value)) ? text(query.value) : "");
  if (reference) return issues.find((issue) => issue.reference.toLowerCase() === reference.toLowerCase()) || null;
  const name = normalizedName(query.issueName || query.value);
  if (!name) return null;
  const matches = issues.filter((issue) => normalizedName(issue.name) === name);
  return matches.length === 1 ? matches[0] : null;
}

export function normalizeCaseIssues(caseData = {}, options = {}) {
  const source = caseData && typeof caseData === "object" ? caseData : {};
  const legacyMeta = options.sequenceGroupMeta && typeof options.sequenceGroupMeta === "object" ? options.sequenceGroupMeta : {};
  const existing = list(source.issues).map((issue) => normalizeIssueShape(issue));
  const idSet = new Set(); const referenceSet = new Set(); const nameSet = new Set(); const conflicts = [];
  existing.forEach((issue) => {
    if (!issue.id || idSet.has(issue.id)) conflicts.push({ code: "duplicate_issue_id", value: issue.id }); else idSet.add(issue.id);
    if (!issue.reference || referenceSet.has(issue.reference.toLowerCase())) conflicts.push({ code: "duplicate_issue_reference", value: issue.reference }); else referenceSet.add(issue.reference.toLowerCase());
    const key = normalizedName(issue.name);
    if (!key || nameSet.has(key)) conflicts.push({ code: "duplicate_issue_name", value: issue.name }); else nameSet.add(key);
  });
  if (conflicts.length) return { caseData: source, changed: false, conflicts, migrationSummary: { created: 0, assigned: 0 } };

  const names = new Map();
  existing.forEach((issue) => names.set(normalizedName(issue.name), issue.name));
  ISSUE_RECORD_COLLECTIONS.forEach((collection) => list(source[collection]).forEach((record) => { const name = text(record?.sequenceGroup); if (name && !names.has(normalizedName(name))) names.set(normalizedName(name), name); }));
  Object.keys(legacyMeta).sort((a, b) => a.localeCompare(b)).forEach((name) => { if (text(name) && !names.has(normalizedName(name))) names.set(normalizedName(name), text(name)); });
  const issues = [...existing];
  let counter = Math.max(1, Number(source.nextIssueReferenceNumber) || 1, ...issues.map((issue) => referenceNumber(issue.reference) + 1), ...list(source.retiredIssueReferences).map((ref) => referenceNumber(ref) + 1));
  const createdAt = text(source.createdAt);
  [...names.entries()].filter(([key]) => !issues.some((issue) => normalizedName(issue.name) === key)).sort((a, b) => a[1].localeCompare(b[1])).forEach(([, name]) => {
    while (referenceSet.has(formatReference(counter).toLowerCase())) counter += 1;
    const reference = formatReference(counter++);
    const meta = Object.entries(legacyMeta).find(([candidate]) => normalizedName(candidate) === normalizedName(name))?.[1] || {};
    issues.push(normalizeIssueShape({}, { id: stableIssueId(source.id, reference), reference, name, description: text(meta.description), createdAt: text(meta.updatedAt) || createdAt, updatedAt: text(meta.updatedAt) || createdAt }));
  });
  const byId = new Map(issues.map((issue) => [issue.id, issue]));
  const byName = new Map(issues.map((issue) => [normalizedName(issue.name), issue]));
  let assigned = 0;
  const next = { ...source };
  ISSUE_RECORD_COLLECTIONS.forEach((collection) => {
    if (!Array.isArray(source[collection])) return;
    next[collection] = source[collection].map((record) => {
      const issue = byId.get(text(record?.sequenceGroupId)) || byName.get(normalizedName(record?.sequenceGroup));
      if (!issue) return record;
      if (record.sequenceGroupId === issue.id && record.sequenceGroup === issue.name) return record;
      assigned += 1;
      return { ...record, sequenceGroupId: issue.id, sequenceGroup: issue.name };
    });
  });
  const orderedIssues = issues.sort((a, b) => referenceNumber(a.reference) - referenceNumber(b.reference) || a.name.localeCompare(b.name));
  next.issues = orderedIssues;
  next.issueSchemaVersion = ISSUE_SCHEMA_VERSION;
  next.nextIssueReferenceNumber = Math.max(counter, Number(source.nextIssueReferenceNumber) || 1);
  next.retiredIssueReferences = [...new Set(list(source.retiredIssueReferences).map((ref) => text(ref).toUpperCase()).filter(Boolean))];
  const changed = JSON.stringify(next) !== JSON.stringify(source);
  return { caseData: changed ? next : source, changed, conflicts: [], migrationSummary: { created: orderedIssues.length - existing.length, assigned } };
}

export function createCaseIssue(caseData, input, options = {}) {
  const normalized = normalizeCaseIssues(caseData).caseData;
  const name = text(input?.name);
  if (!name) return { success: false, errors: ["Issue name is required."], caseData };
  if (list(normalized.issues).some((issue) => normalizedName(issue.name) === normalizedName(name))) return { success: false, errors: ["An Issue with this name already exists."], caseData };
  const allocation = allocateNextIssueReference(normalized);
  const now = text(options.now) || new Date().toISOString();
  const issue = normalizeIssueShape(input, { id: stableIssueId(normalized.id, allocation.reference), reference: allocation.reference, name, createdAt: now, updatedAt: now });
  const errors = validateIssue(issue, normalized);
  if (errors.length) return { success: false, errors, caseData };
  return { success: true, issue, caseData: { ...normalized, issues: [...normalized.issues, issue], nextIssueReferenceNumber: allocation.nextIssueReferenceNumber } };
}

export function updateCaseIssue(caseData, issueId, updates, options = {}) {
  const normalized = normalizeCaseIssues(caseData).caseData;
  const current = resolveCaseIssue(normalized, { issueId });
  if (!current) return { success: false, errors: ["Issue could not be resolved."], caseData };
  const forbidden = ["id", "reference", "createdAt"].some((key) => updates?.[key] != null && updates[key] !== current[key]);
  if (forbidden) return { success: false, errors: ["Issue ID, reference, and creation date are immutable."], caseData };
  if (updates?.status != null && !ISSUE_STATUSES.includes(updates.status)) return { success: false, errors: ["Issue status is invalid."], caseData };
  if (updates?.priority != null && !ISSUE_PRIORITIES.includes(updates.priority)) return { success: false, errors: ["Issue priority is invalid."], caseData };
  if (updates?.reviewDate != null && !validDate(updates.reviewDate)) return { success: false, errors: ["Issue review date must use YYYY-MM-DD."], caseData };
  const name = text(updates?.name ?? current.name);
  if (normalized.issues.some((issue) => issue.id !== issueId && normalizedName(issue.name) === normalizedName(name))) return { success: false, errors: ["An Issue with this name already exists."], caseData };
  const now = text(options.now) || new Date().toISOString();
  const issue = normalizeIssueShape({ ...current, ...updates, id: current.id, reference: current.reference, createdAt: current.createdAt, name, updatedAt: now });
  const errors = validateIssue(issue, normalized);
  if (errors.length) return { success: false, errors, caseData };
  const next = { ...normalized, issues: normalized.issues.map((item) => item.id === issueId ? issue : item) };
  ISSUE_RECORD_COLLECTIONS.forEach((collection) => { if (Array.isArray(next[collection])) next[collection] = next[collection].map((record) => record.sequenceGroupId === issueId ? { ...record, sequenceGroup: issue.name } : record); });
  return { success: true, issue, caseData: next };
}

export const renameCaseIssue = (caseData, issueId, newName, options) => updateCaseIssue(caseData, issueId, { name: newName }, options);

export function assignRecordToIssue(caseData, recordType, recordId, issueId) {
  const normalized = normalizeCaseIssues(caseData).caseData;
  const issue = resolveCaseIssue(normalized, { issueId });
  if (!issue) return { success: false, errors: ["Issue could not be resolved."], caseData };
  if (!ISSUE_RECORD_COLLECTIONS.includes(recordType)) return { success: false, errors: ["Record type is not supported."], caseData };
  let found = false;
  const records = list(normalized[recordType]).map((record) => record.id === recordId ? (found = true, { ...record, sequenceGroupId: issue.id, sequenceGroup: issue.name }) : record);
  return found ? { success: true, issue, caseData: { ...normalized, [recordType]: records } } : { success: false, errors: ["Record could not be resolved."], caseData };
}

export function removeRecordFromIssue(caseData, recordType, recordId) {
  const normalized = normalizeCaseIssues(caseData).caseData;
  if (!ISSUE_RECORD_COLLECTIONS.includes(recordType)) return { success: false, errors: ["Record type is not supported."], caseData };
  let found = false;
  const records = list(normalized[recordType]).map((record) => record.id === recordId ? (found = true, { ...record, sequenceGroupId: "", sequenceGroup: "" }) : record);
  return found ? { success: true, caseData: { ...normalized, [recordType]: records } } : { success: false, errors: ["Record could not be resolved."], caseData };
}

export function deleteCaseIssue(caseData, issueId, options = {}) {
  const normalized = normalizeCaseIssues(caseData).caseData;
  const issue = resolveCaseIssue(normalized, { issueId });
  if (!issue) return { success: false, errors: ["Issue could not be resolved."], caseData };
  let next = { ...normalized, issues: normalized.issues.filter((item) => item.id !== issueId), retiredIssueReferences: [...new Set([...normalized.retiredIssueReferences, issue.reference])], retiredIssues: [...list(normalized.retiredIssues), { id: issue.id, reference: issue.reference, name: issue.name, deletedAt: text(options.now) || new Date().toISOString() }] };
  ISSUE_RECORD_COLLECTIONS.forEach((collection) => { if (Array.isArray(next[collection])) next[collection] = next[collection].map((record) => record.sequenceGroupId === issueId || normalizedName(record.sequenceGroup) === normalizedName(issue.name) ? { ...record, sequenceGroupId: "", sequenceGroup: "" } : record); });
  return { success: true, deletedIssue: issue, caseData: next };
}

export function mergeCaseIssues(caseData, sourceIssueId, destinationIssueId, options = {}) {
  const normalized = normalizeCaseIssues(caseData).caseData;
  const source = resolveCaseIssue(normalized, { issueId: sourceIssueId }); const destination = resolveCaseIssue(normalized, { issueId: destinationIssueId });
  if (!source || !destination || source.id === destination.id) return { success: false, errors: ["Source and destination Issues must be distinct and resolvable."], caseData };
  let next = { ...normalized, issues: normalized.issues.filter((item) => item.id !== source.id), retiredIssueReferences: [...new Set([...normalized.retiredIssueReferences, source.reference])], retiredIssues: [...list(normalized.retiredIssues), { id: source.id, reference: source.reference, name: source.name, mergedIntoIssueId: destination.id, deletedAt: text(options.now) || new Date().toISOString() }] };
  ISSUE_RECORD_COLLECTIONS.forEach((collection) => { if (Array.isArray(next[collection])) next[collection] = next[collection].map((record) => record.sequenceGroupId === source.id || normalizedName(record.sequenceGroup) === normalizedName(source.name) ? { ...record, sequenceGroupId: destination.id, sequenceGroup: destination.name } : record); });
  return { success: true, sourceIssue: source, destinationIssue: destination, caseData: next };
}

export function buildIssueIndex(caseData = {}) {
  const normalized = normalizeCaseIssues(caseData).caseData;
  return list(normalized.issues).map((issue) => ({ id: issue.id, reference: issue.reference, name: issue.name, displayLabel: getIssueDisplayLabel(issue), status: issue.status, priority: issue.priority, ownerPartyId: issue.ownerPartyId, reviewDate: issue.reviewDate, directRecordCount: ISSUE_RECORD_COLLECTIONS.reduce((sum, collection) => sum + list(normalized[collection]).filter((record) => record.sequenceGroupId === issue.id).length, 0) }));
}

export const HUMAN_READABLE_ISSUE_PROMPT = "Human-readable Issue references\n\nIn explanations, summaries, recommendations and questions, refer to Issues using: ISS-003 — Heating Failure. Do not refer to an Issue using only its internal UUID. Internal Issue IDs may be used only inside structured machine-readable update operations.";
