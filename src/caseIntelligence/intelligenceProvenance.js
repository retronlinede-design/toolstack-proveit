import {
  CASE_INTELLIGENCE_CONTEXT_SCHEMA_ID,
  CASE_INTELLIGENCE_CONTEXT_SCHEMA_VERSION,
  buildCaseIntelligenceContext,
} from "./contextInspector.js";

export const INTELLIGENCE_FRESHNESS_STATES = Object.freeze(["current", "stale", "unknown"]);

function text(value) { return typeof value === "string" ? value.trim() : ""; }
function list(value) { return Array.isArray(value) ? value : []; }
function isObject(value) { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
function citationKey(citation) { return [text(citation?.recordType), text(citation?.recordId), text(citation?.scopeRelation), text(citation?.issueId), text(citation?.capturedLabel)].join("\u0000"); }

function sourceContractStatus(sourceContract) {
  const contract = sourceContract == null
    ? { id: CASE_INTELLIGENCE_CONTEXT_SCHEMA_ID, version: CASE_INTELLIGENCE_CONTEXT_SCHEMA_VERSION }
    : sourceContract;
  if (!isObject(contract) || contract.id !== CASE_INTELLIGENCE_CONTEXT_SCHEMA_ID || contract.version !== CASE_INTELLIGENCE_CONTEXT_SCHEMA_VERSION) {
    return { supported: false, error: "Unsupported Case Intelligence source contract." };
  }
  return { supported: true, id: contract.id, version: contract.version };
}

function sourceScope(source) {
  if (!isObject(source?.scope)) return { valid: false, error: "Captured source scope is unavailable." };
  if (source.scope.type === "case") return { valid: true, scope: "case", issueId: "" };
  if (source.scope.type === "issue" && text(source.scope.issueId)) return { valid: true, scope: "issue", issueId: text(source.scope.issueId) };
  return { valid: false, error: "Captured Issue scope is unavailable or ambiguous." };
}

function buildCurrentContext(entry, caseData, sourceContract) {
  const contract = sourceContractStatus(sourceContract);
  if (!contract.supported) return { available: false, reason: contract.error, contract };
  if (!isObject(entry) || !text(entry.caseId) || !isObject(entry.source)) return { available: false, reason: "Stored intelligence source is unavailable.", contract };
  if (!isObject(caseData) || !text(caseData.id) || entry.caseId !== caseData.id) return { available: false, reason: "Current canonical case is unavailable or belongs to another case.", contract };
  const scope = sourceScope(entry.source);
  if (!scope.valid) return { available: false, reason: scope.error, contract };
  try {
    const context = buildCaseIntelligenceContext(caseData, { scope: scope.scope, issueId: scope.issueId });
    if (!context.scope?.valid) return { available: false, reason: "Captured Issue scope is unavailable or invalid.", contract, context };
    return { available: true, context, contract };
  } catch {
    return { available: false, reason: "Current source context could not be reconstructed safely.", contract };
  }
}

export function assessIntelligenceFreshness(entry, caseData, { sourceContract = undefined } = {}) {
  const current = buildCurrentContext(entry, caseData, sourceContract);
  if (!current.available) return { state: "unknown", reason: current.reason, sourceContract: current.contract };
  const captured = entry.source;
  const revisionMatches = Number.isSafeInteger(captured.caseRevision) && captured.caseRevision === current.context.source.caseRevision;
  const fingerprintMatches = text(captured.sourceFingerprint) && captured.sourceFingerprint === current.context.source.sourceFingerprint;
  return {
    state: revisionMatches && fingerprintMatches ? "current" : "stale",
    reason: revisionMatches && fingerprintMatches ? "Captured revision and fingerprint match the current canonical context." : "Captured revision or fingerprint differs from the current canonical context.",
    sourceContract: current.contract,
    currentSource: {
      caseId: current.context.source.caseId,
      caseRevision: current.context.source.caseRevision,
      sourceFingerprint: current.context.source.sourceFingerprint,
      scope: current.context.scope,
    },
  };
}

function inventoryIndex(context) {
  const index = new Map();
  Object.values(context?.inventory || {}).flat().forEach((record) => {
    index.set(`${record.recordType}:${record.recordId}`, record);
  });
  return index;
}

function assessCitation(citation, entry, current, index) {
  const captured = {
    recordType: text(citation?.recordType),
    recordId: text(citation?.recordId),
    scopeRelation: text(citation?.scopeRelation),
    issueId: text(citation?.issueId) || null,
    capturedLabel: text(citation?.capturedLabel),
  };
  if (!captured.recordType || !captured.recordId || !["direct", "linked_context", "unresolved"].includes(captured.scopeRelation)) {
    return { citation: captured, status: "invalid", reason: "Citation identity or scope relation is invalid." };
  }
  if (text(citation?.caseId) && text(citation.caseId) !== text(entry?.caseId)) {
    return { citation: captured, status: "cross_case", reason: "Citation belongs to a different canonical case." };
  }
  if (!current.available) return { citation: captured, status: "unavailable", reason: current.reason };
  const record = index.get(`${captured.recordType}:${captured.recordId}`);
  if (!record) {
    return { citation: captured, status: captured.scopeRelation === "unresolved" ? "unresolved" : "missing", reason: "Canonical source record is unavailable in the captured scope." };
  }
  return {
    citation: captured,
    status: "available",
    current: {
      recordType: record.recordType,
      recordId: record.recordId,
      displayLabel: record.displayLabel,
      scopeRelation: record.scopeRelation,
      issue: record.issue,
    },
    relationMatches: captured.scopeRelation === record.scopeRelation,
  };
}

export function assessIntelligenceCitations(entry, caseData, { sourceContract = undefined } = {}) {
  const current = buildCurrentContext(entry, caseData, sourceContract);
  const index = current.available ? inventoryIndex(current.context) : new Map();
  return list(entry?.citations)
    .map((citation, indexValue) => ({ citation, indexValue }))
    .sort((left, right) => citationKey(left.citation).localeCompare(citationKey(right.citation)) || left.indexValue - right.indexValue)
    .map(({ citation }) => assessCitation(citation, entry, current, index));
}

export function assessIntelligenceProvenance(entry, caseData, options = {}) {
  const freshness = assessIntelligenceFreshness(entry, caseData, options);
  const citations = assessIntelligenceCitations(entry, caseData, options);
  return {
    readOnly: true,
    localOnly: true,
    entry: { caseId: text(entry?.caseId), id: text(entry?.id), kind: text(entry?.entityType) || "message" },
    freshness,
    citations,
    summary: {
      available: citations.filter((item) => item.status === "available").length,
      missing: citations.filter((item) => item.status === "missing").length,
      unresolved: citations.filter((item) => item.status === "unresolved").length,
      invalid: citations.filter((item) => ["invalid", "cross_case"].includes(item.status)).length,
    },
  };
}
