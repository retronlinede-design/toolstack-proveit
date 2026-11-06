import {
  createEmptyIntelligenceLibrary,
  calculateIntelligenceRevisionChecksum,
  validateIntelligenceLibraryIntegrity,
} from "./intelligenceLibrary.js";
import {
  CASE_INTELLIGENCE_CONTEXT_SCHEMA_ID,
  CASE_INTELLIGENCE_CONTEXT_SCHEMA_VERSION,
} from "./contextInspector.js";

function text(value) { return typeof value === "string" ? value.trim() : ""; }
function isObject(value) { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
function canonical(value) {
  if (value == null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(canonical);
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
}
function sameValue(left, right) { return JSON.stringify(canonical(left)) === JSON.stringify(canonical(right)); }
function recordKey(record) { return `${record?.recordType || ""}:${record?.recordId || ""}`; }
function citationKey(citation) { return `${citation.recordType}:${citation.recordId}:${citation.scopeRelation}`; }
function defaultId(prefix) {
  const suffix = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${suffix}`;
}

function validateContext(caseItem, context) {
  if (!isObject(caseItem) || !text(caseItem.id)) throw new TypeError("A canonical case is required.");
  if (!isObject(context) || context.localOnly !== true || context.readOnly !== true) throw new TypeError("A local, read-only Case Intelligence context is required.");
  if (context?.schema?.id !== CASE_INTELLIGENCE_CONTEXT_SCHEMA_ID || context?.schema?.version !== CASE_INTELLIGENCE_CONTEXT_SCHEMA_VERSION) {
    throw new TypeError("Unsupported Case Intelligence source contract.");
  }
  if (context?.source?.caseId !== caseItem.id) throw new TypeError("Case Intelligence context belongs to a different case.");
  if (!Number.isSafeInteger(context?.source?.caseRevision) || context.source.caseRevision < 1 || !text(context?.source?.sourceFingerprint)) {
    throw new TypeError("Case Intelligence context source revision or fingerprint is unavailable.");
  }
  if (!context?.scope?.valid || !["case", "issue"].includes(context.scope.type)) throw new TypeError("Case Intelligence context scope is unavailable or invalid.");
  if (context.scope.type === "issue" && !text(context.scope.issueId)) throw new TypeError("Canonical Issue scope is unavailable.");
}

function contextRecords(context) {
  return Object.values(context.inventory || {}).flat().filter((record) => text(record?.recordType) && text(record?.recordId));
}

function buildCitation(record, createdAt) {
  const issueId = text(record?.issue?.issueId);
  return {
    recordType: record.recordType,
    recordId: record.recordId,
    scopeRelation: record.scopeRelation,
    ...(issueId ? { issueId } : {}),
    capturedLabel: text(record.displayLabel) || `${record.recordType}:${record.recordId}`,
    capturedAt: createdAt,
    availability: "available",
  };
}

function duplicateItemExists(library, { type, statement, source, citations }) {
  const expectedCitations = [...citations].sort((left, right) => citationKey(left).localeCompare(citationKey(right)));
  return Object.values(library.intelligenceItemRevisions || {}).some((revision) => revision?.entityType === "item"
    && library.intelligenceItems?.[revision.entityId]?.type === type
    && text(revision?.content?.statement) === statement
    && sameValue(revision.source, source)
    && sameValue([...(revision.citations || [])].sort((left, right) => citationKey(left).localeCompare(citationKey(right))), expectedCitations));
}

/**
 * Creates one immutable, user-authored Intelligence Item revision from an
 * already-built CI-01 context. The caller owns case persistence.
 */
export async function buildManualIntelligenceItemCandidate({
  caseItem,
  context,
  type,
  statement,
  rationale = "",
  author,
  citationKeys = [],
  createdAt = new Date().toISOString(),
  idFactory = defaultId,
} = {}) {
  validateContext(caseItem, context);
  const normalizedType = text(type);
  const normalizedStatement = text(statement);
  const normalizedAuthor = text(author);
  if (!normalizedType) throw new TypeError("Choose an intelligence item type.");
  if (!normalizedStatement) throw new TypeError("Enter a statement or note.");
  if (!normalizedAuthor) throw new TypeError("Enter the human author of this note.");
  if (Number.isNaN(Date.parse(createdAt))) throw new TypeError("A valid creation timestamp is required.");

  const existing = caseItem.intelligenceLibrary == null
    ? createEmptyIntelligenceLibrary(caseItem.id)
    : structuredClone(caseItem.intelligenceLibrary);
  const integrity = await validateIntelligenceLibraryIntegrity(existing, { caseId: caseItem.id });
  if (!integrity.valid) throw new TypeError(`Existing Intelligence Library is not valid: ${integrity.errors.join(" ")}`);

  const records = new Map(contextRecords(context).map((record) => [recordKey(record), record]));
  const requestedKeys = [...new Set((Array.isArray(citationKeys) ? citationKeys : []).map(text).filter(Boolean))];
  if (requestedKeys.some((key) => !records.has(key))) throw new TypeError("A selected citation is no longer available in the captured source context.");
  const citations = requestedKeys.map((key) => buildCitation(records.get(key), createdAt))
    .sort((left, right) => citationKey(left).localeCompare(citationKey(right)));
  const source = {
    caseRevision: context.source.caseRevision,
    sourceFingerprint: context.source.sourceFingerprint,
    scope: context.scope.type === "issue"
      ? {
        type: "issue",
        issueId: context.scope.issueId,
        issueReference: text(context.scope.issueReference),
        issueName: text(context.scope.issueName),
        label: text(context.scope.label),
      }
      : { type: "case", label: text(context.scope.label) || "Entire Case" },
  };
  if (duplicateItemExists(existing, { type: normalizedType, statement: normalizedStatement, source, citations })) {
    throw new TypeError("An identical Intelligence Library item already exists for this captured context.");
  }

  const itemId = text(idFactory("intelligence-item"));
  const revisionId = text(idFactory("intelligence-item-revision"));
  if (!itemId || !revisionId || itemId === revisionId || existing.intelligenceItems[itemId] || existing.intelligenceItemRevisions[revisionId]) {
    throw new TypeError("Could not allocate a unique Intelligence Library identity.");
  }
  const revision = {
    entityType: "item",
    id: revisionId,
    entityId: itemId,
    caseId: caseItem.id,
    versionNumber: 1,
    parentRevisionId: null,
    createdAt,
    author: { kind: "user", label: normalizedAuthor },
    content: {
      statement: normalizedStatement,
      ...(text(rationale) ? { rationale: text(rationale) } : {}),
      uncertainty: "unknown",
      confidence: null,
    },
    source,
    citations,
    review: { status: "unreviewed", by: null, at: null },
    contentChecksum: "",
  };
  revision.contentChecksum = await calculateIntelligenceRevisionChecksum(revision);
  const item = {
    id: itemId,
    caseId: caseItem.id,
    type: normalizedType,
    createdAt,
    currentRevisionId: revisionId,
    revisionIds: [revisionId],
    status: "under_review",
  };
  const intelligenceLibrary = structuredClone(existing);
  intelligenceLibrary.intelligenceItems[itemId] = item;
  intelligenceLibrary.intelligenceItemRevisions[revisionId] = revision;
  const candidateIntegrity = await validateIntelligenceLibraryIntegrity(intelligenceLibrary, { caseId: caseItem.id });
  if (!candidateIntegrity.valid) throw new TypeError(`Intelligence Library candidate is not valid: ${candidateIntegrity.errors.join(" ")}`);
  return { intelligenceLibrary, item, revision };
}
