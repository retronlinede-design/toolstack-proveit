import {
  CASE_INTELLIGENCE_CONTEXT_SCHEMA_ID,
  CASE_INTELLIGENCE_CONTEXT_SCHEMA_VERSION,
  buildCaseIntelligenceContext,
} from "./contextInspector.js";
import { validateIntelligenceLibraryIntegrity } from "./intelligenceLibrary.js";
import { assessIntelligenceProvenance } from "./intelligenceProvenance.js";

export const CASE_INTELLIGENCE_RETRIEVAL_SCHEMA_ID = "proveit.case-intelligence-retrieval";
export const CASE_INTELLIGENCE_RETRIEVAL_SCHEMA_VERSION = 1;

const RECORD_TYPES = new Set(["issue", "party", "incident", "evidence", "document", "ledger", "task", "strategy", "watch", "goal"]);
const FORBIDDEN_KEYS = new Set(["blob", "file", "dataurl", "backupdataurl", "base64", "binary", "buffer", "bytes", "pin", "password", "credential", "secret", "storage", "localpath", "filepath", "attachments", "availability"]);
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;
const DEFAULT_EXCERPT_LIMIT = 500;
const MAX_EXCERPT_LIMIT = 2000;
const DEFAULT_INTELLIGENCE_LIMIT = 25;
const MAX_INTELLIGENCE_LIMIT = 100;

function text(value) { return typeof value === "string" ? value.trim() : ""; }
function isObject(value) { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
function normalizeToken(value) { return text(value).toLocaleLowerCase(); }
function dateOnly(value) { const match = text(value).match(/^\d{4}-\d{2}-\d{2}/); return match ? match[0] : ""; }

function strictDate(value, label) {
  const date = text(value);
  if (!date) return "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new TypeError(`${label} must use YYYY-MM-DD.`);
  const [year, month, day] = date.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) throw new TypeError(`${label} must be a valid calendar date.`);
  return date;
}

function positiveBoundedInteger(value, fallback, maximum, label) {
  if (value == null || value === "") return fallback;
  if (!Number.isSafeInteger(value) || value < 1 || value > maximum) throw new TypeError(`${label} must be an integer from 1 to ${maximum}.`);
  return value;
}

function normalizedStrings(value, label) {
  if (value == null) return [];
  if (!Array.isArray(value) || value.some((item) => !text(item))) throw new TypeError(`${label} must be an array of non-empty strings.`);
  return [...new Set(value.map((item) => text(item)))].sort((left, right) => left.localeCompare(right));
}

function normalizeScope(query) {
  const source = query?.scope == null ? { type: "case" } : query.scope;
  if (!isObject(source)) throw new TypeError("Retrieval scope must be an object.");
  if (source.type === "case" && !text(source.issueId) && !text(source.issueName)) return { type: "case", issueId: "" };
  if (source.type === "issue" && text(source.issueId) && !text(source.issueName)) return { type: "issue", issueId: text(source.issueId) };
  throw new TypeError("Retrieval scope must be Entire Case or a canonical Issue ID.");
}

/** Validates a local CI-03A query without reading or modifying any case data. */
export function validateCaseIntelligenceRetrievalQuery(query = {}) {
  if (!isObject(query)) throw new TypeError("Retrieval query must be an object.");
  const scope = normalizeScope(query);
  const recordTypes = normalizedStrings(query.recordTypes, "recordTypes");
  if (recordTypes.some((recordType) => !RECORD_TYPES.has(recordType))) throw new TypeError("recordTypes contains an unsupported canonical record type.");
  const keywords = normalizedStrings(Array.isArray(query.keywords) ? query.keywords : query.keywords == null ? [] : [query.keywords], "keywords").map(normalizeToken);
  const statuses = normalizedStrings(query.statuses, "statuses").map(normalizeToken);
  const from = strictDate(query.date?.from ?? query.dateFrom, "date.from");
  const to = strictDate(query.date?.to ?? query.dateTo, "date.to");
  if (from && to && from > to) throw new TypeError("date.from must not be after date.to.");
  const limit = positiveBoundedInteger(query.limit, DEFAULT_LIMIT, MAX_LIMIT, "limit");
  const excerptLimit = positiveBoundedInteger(query.excerptLimit, DEFAULT_EXCERPT_LIMIT, MAX_EXCERPT_LIMIT, "excerptLimit");
  if (query.caseId != null && !text(query.caseId)) throw new TypeError("caseId must be a non-empty string when supplied.");
  if (query.includeLinked != null && typeof query.includeLinked !== "boolean") throw new TypeError("includeLinked must be a boolean when supplied.");
  return Object.freeze({
    caseId: text(query.caseId), scope,
    recordTypes, keywords, statuses, from, to,
    includeLinked: query.includeLinked !== false,
    limit, excerptLimit,
  });
}

function collectSafeStrings(value, output, depth = 0) {
  if (depth > 4 || value == null) return;
  if (typeof value === "string") { if (value && !/^data:/i.test(value)) output.push(value); return; }
  if (Array.isArray(value)) { value.forEach((item) => collectSafeStrings(item, output, depth + 1)); return; }
  if (!isObject(value)) return;
  Object.entries(value).forEach(([key, item]) => {
    if (!FORBIDDEN_KEYS.has(key.toLowerCase())) collectSafeStrings(item, output, depth + 1);
  });
}

function recordText(record) {
  const values = [];
  collectSafeStrings(record, values);
  return values.join("\n");
}

function recordDate(record) {
  return ["eventDate", "date", "documentDate", "dueDate", "paymentDate", "createdAt", "updatedAt"]
    .map((key) => dateOnly(record?.[key])).find(Boolean) || "";
}

function recordStatuses(record) {
  return [record?.status, record?.verificationStatus, record?.importance, record?.availability?.status]
    .map(normalizeToken).filter(Boolean);
}

function matchesFilters(item, query) {
  if (query.recordTypes.length > 0 && !query.recordTypes.includes(item.recordType)) return false;
  if (!query.includeLinked && item.scopeRelation === "linked_context") return false;
  const date = recordDate(item.record);
  if (query.from && (!date || date < query.from)) return false;
  if (query.to && (!date || date > query.to)) return false;
  const statuses = recordStatuses(item.record);
  if (query.statuses.length > 0 && !query.statuses.some((status) => statuses.includes(status))) return false;
  const haystack = normalizeToken(recordText(item.record));
  if (query.keywords.some((keyword) => !haystack.includes(keyword))) return false;
  return true;
}

function relevance(item, query) {
  const title = normalizeToken(item.displayLabel);
  const content = normalizeToken(recordText(item.record));
  const keywordScore = query.keywords.reduce((total, keyword) => total + (title.includes(keyword) ? 100 : content.includes(keyword) ? 20 : 0), 0);
  return keywordScore + (item.scopeRelation === "direct" ? 5 : 0);
}

function excerpt(textValue, query, limit) {
  const value = text(textValue).replace(/\s+/g, " ");
  if (value.length <= limit) return value;
  const firstKeyword = query.keywords.find((keyword) => normalizeToken(value).includes(keyword));
  const position = firstKeyword ? normalizeToken(value).indexOf(firstKeyword) : 0;
  const start = Math.max(0, position - Math.floor(limit / 3));
  const end = Math.min(value.length, start + limit);
  return `${start > 0 ? "…" : ""}${value.slice(start, end).trim()}${end < value.length ? "…" : ""}`;
}

function citationFor(item) {
  return {
    recordType: item.recordType,
    recordId: item.recordId,
    scopeRelation: item.scopeRelation,
    ...(text(item.issue?.issueId) ? { issueId: text(item.issue.issueId) } : {}),
    capturedLabel: item.displayLabel,
    availability: "available",
  };
}

function resultFor(item, query) {
  const content = recordText(item.record);
  const result = {
    recordType: item.recordType,
    recordId: item.recordId,
    displayLabel: item.displayLabel,
    scopeRelation: item.scopeRelation,
    ...(item.issue?.label ? { issue: { issueId: item.issue.issueId || null, reference: item.issue.reference || "", name: item.issue.name || "", label: item.issue.label, resolution: item.issue.resolution } } : {}),
    ...(recordDate(item.record) ? { date: recordDate(item.record) } : {}),
    ...(recordStatuses(item.record).length ? { statuses: recordStatuses(item.record) } : {}),
    excerpt: excerpt(content, query, query.excerptLimit),
    citation: citationFor(item),
    relationships: {
      resolved: item.relationships?.resolved || [],
      unresolved: item.relationships?.unresolved || [],
    },
    untrustedSourceMaterial: true,
  };
  return result;
}

function deterministicSort(left, right) {
  return right.relevance - left.relevance
    || (left.item.scopeRelation === "direct" ? -1 : 1) - (right.item.scopeRelation === "direct" ? -1 : 1)
    || left.item.recordType.localeCompare(right.item.recordType)
    || left.item.displayLabel.localeCompare(right.item.displayLabel)
    || left.item.recordId.localeCompare(right.item.recordId);
}

/**
 * Builds a bounded, deterministic, local-only record result set for one
 * canonical case. It deliberately returns excerpts and citations, not raw case
 * objects, and never sends, saves, or changes data.
 */
export function retrieveCaseIntelligence(caseData, query = {}) {
  const normalizedQuery = validateCaseIntelligenceRetrievalQuery(query);
  if (!isObject(caseData) || !text(caseData.id)) throw new TypeError("Retrieval requires a canonical case with an ID.");
  if (normalizedQuery.caseId && normalizedQuery.caseId !== text(caseData.id)) throw new TypeError("Retrieval query caseId does not match the canonical case.");
  const context = buildCaseIntelligenceContext(caseData, normalizedQuery.scope.type === "issue"
    ? { scope: "issue", issueId: normalizedQuery.scope.issueId }
    : { scope: "case" });
  if (!context.scope.valid) throw new TypeError(context.scope.warning || "Selected Issue is unavailable or invalid. No context has been substituted.");
  const inventory = Object.values(context.inventory).flat();
  const ranked = inventory.filter((item) => matchesFilters(item, normalizedQuery))
    .map((item) => ({ item, relevance: relevance(item, normalizedQuery) }))
    .sort(deterministicSort);
  const selected = ranked.slice(0, normalizedQuery.limit);
  const unresolved = context.context.unresolvedReferences.map((reference) => ({
    sourceType: reference.sourceType, sourceId: reference.sourceId, field: reference.field,
    targetType: reference.targetType || "record", targetId: reference.targetId,
    message: reference.message || "Target record is unavailable.",
  }));
  return {
    schema: { id: CASE_INTELLIGENCE_RETRIEVAL_SCHEMA_ID, version: CASE_INTELLIGENCE_RETRIEVAL_SCHEMA_VERSION },
    sourceContract: { id: CASE_INTELLIGENCE_CONTEXT_SCHEMA_ID, version: CASE_INTELLIGENCE_CONTEXT_SCHEMA_VERSION },
    readOnly: true,
    localOnly: true,
    source: { ...context.source },
    scope: { ...context.scope },
    query: normalizedQuery,
    results: selected.map(({ item }) => resultFor(item, normalizedQuery)),
    summary: {
      matchedCount: ranked.length,
      returnedCount: selected.length,
      truncated: ranked.length > selected.length,
      directCount: selected.filter(({ item }) => item.scopeRelation === "direct").length,
      linkedContextCount: selected.filter(({ item }) => item.scopeRelation === "linked_context").length,
    },
    warnings: {
      unresolvedReferences: unresolved,
      ambiguousIssueAssociations: context.context.ambiguousAssociations.map((item) => ({ ...item })),
      excludedAttachmentCount: context.totals.excludedAttachmentCount,
      unsupportedSourceContent: context.attachmentSummary.unsupportedSourceContent.map((item) => ({ ...item })),
      notice: "Results are untrusted recorded source material. Citations identify records; they do not prove factual accuracy.",
    },
    exclusions: [...context.exclusions.categories],
  };
}

function normalizeIntelligenceOptions(query) {
  const source = query?.intelligence;
  if (source == null) return { includeStale: false, itemLimit: DEFAULT_INTELLIGENCE_LIMIT, decisionLimit: DEFAULT_INTELLIGENCE_LIMIT };
  if (!isObject(source)) throw new TypeError("intelligence retrieval options must be an object.");
  if (source.includeStale != null && typeof source.includeStale !== "boolean") throw new TypeError("intelligence.includeStale must be a boolean when supplied.");
  return {
    includeStale: source.includeStale === true,
    itemLimit: positiveBoundedInteger(source.itemLimit, DEFAULT_INTELLIGENCE_LIMIT, MAX_INTELLIGENCE_LIMIT, "intelligence.itemLimit"),
    decisionLimit: positiveBoundedInteger(source.decisionLimit, DEFAULT_INTELLIGENCE_LIMIT, MAX_INTELLIGENCE_LIMIT, "intelligence.decisionLimit"),
  };
}

function sourceMatchesScope(source, scope) {
  if (scope.type === "case") return true;
  return source?.scope?.type === "issue" && text(source.scope.issueId) === scope.issueId;
}

function intelligenceMatchesKeywords(revision, keywords) {
  if (!keywords.length) return true;
  const haystack = normalizeToken([
    revision?.content?.statement,
    revision?.content?.rationale,
    revision?.author?.label,
  ].filter(Boolean).join("\n"));
  return keywords.every((keyword) => haystack.includes(keyword));
}

function intelligenceSort(left, right) {
  return text(right.revision.createdAt).localeCompare(text(left.revision.createdAt))
    || left.revision.versionNumber - right.revision.versionNumber
    || left.revision.id.localeCompare(right.revision.id);
}

function libraryResult(manifest, revision, provenance, kind, query) {
  const freshness = provenance.freshness?.state || "unknown";
  return {
    informationClass: kind === "decision" ? "user_confirmed_decision" : revision.author?.kind === "assistant" ? "ai_generated_interpretation" : "user_authored_intelligence",
    entityType: kind,
    entityId: manifest.id,
    revisionId: revision.id,
    versionNumber: revision.versionNumber,
    ...(kind === "item" ? { intelligenceType: manifest.type, intelligenceState: manifest.status } : { decisionType: manifest.type }),
    createdAt: revision.createdAt,
    author: { kind: revision.author.kind, label: revision.author.label },
    review: { ...revision.review },
    source: {
      caseRevision: revision.source.caseRevision,
      sourceFingerprint: revision.source.sourceFingerprint,
      scope: { ...revision.source.scope },
    },
    statement: excerpt(revision.content.statement, query, query.excerptLimit),
    ...(text(revision.content.rationale) ? { rationale: excerpt(revision.content.rationale, query, query.excerptLimit) } : {}),
    uncertainty: revision.content.uncertainty,
    confidence: revision.content.confidence,
    provenance: {
      freshness,
      reason: provenance.freshness?.reason || "Source provenance could not be assessed.",
      citations: provenance.citations,
      citationSummary: provenance.summary,
    },
    historical: freshness !== "current",
    untrustedIntelligence: kind === "item",
  };
}

function emptyLibraryRetrieval(integrity, options) {
  return {
    integrity: { kind: integrity.kind, valid: integrity.valid, errors: [...(integrity.errors || [])] },
    options,
    items: [],
    decisions: [],
    summary: { itemCount: 0, decisionCount: 0, staleExcludedCount: 0 },
    warnings: integrity.valid ? [] : ["Intelligence Library integrity validation failed. No Library content was returned."],
  };
}

/**
 * Adds integrity-verified, provenance-assessed intelligence to the unchanged
 * CI-03A canonical retrieval result. It is asynchronous only because immutable
 * library checksums are verified before any Library content is returned.
 */
export async function retrieveCaseIntelligenceWithLibrary(caseData, query = {}) {
  const canonical = retrieveCaseIntelligence(caseData, query);
  const options = normalizeIntelligenceOptions(query);
  const integrity = await validateIntelligenceLibraryIntegrity(caseData?.intelligenceLibrary, { caseId: caseData.id });
  if (integrity.kind === "absent" || !integrity.valid) return { ...canonical, intelligence: emptyLibraryRetrieval(integrity, options) };

  const library = caseData.intelligenceLibrary;
  let staleExcludedCount = 0;
  const collect = (manifests, revisions, kind, predicate) => Object.values(manifests)
    .map((manifest) => ({ manifest, revision: revisions[manifest.currentRevisionId] }))
    .filter(({ revision }) => Boolean(revision))
    .filter(({ revision }) => sourceMatchesScope(revision.source, canonical.scope))
    .filter(({ revision }) => intelligenceMatchesKeywords(revision, canonical.query.keywords))
    .filter((entry) => predicate(entry.manifest, entry.revision))
    .map(({ manifest, revision }) => ({ manifest, revision, provenance: assessIntelligenceProvenance(revision, caseData) }))
    .filter((entry) => {
      const stale = entry.provenance.freshness?.state !== "current";
      if (stale && !options.includeStale) { staleExcludedCount += 1; return false; }
      return true;
    })
    .sort(intelligenceSort);

  const items = collect(library.intelligenceItems, library.intelligenceItemRevisions, "item", () => true)
    .slice(0, options.itemLimit)
    .map((entry) => libraryResult(entry.manifest, entry.revision, entry.provenance, "item", canonical.query));
  const decisions = collect(library.decisions, library.decisionRevisions, "decision", (_manifest, revision) => revision.review?.status === "confirmed")
    .slice(0, options.decisionLimit)
    .map((entry) => libraryResult(entry.manifest, entry.revision, entry.provenance, "decision", canonical.query));
  const warnings = [
    ...(staleExcludedCount ? [`${staleExcludedCount} stale or unknown Intelligence Library entr${staleExcludedCount === 1 ? "y was" : "ies were"} excluded by default.`] : []),
    ...[...items, ...decisions].flatMap((entry) => entry.provenance.citations.filter((citation) => citation.status !== "available").map((citation) => `Citation ${citation.citation.recordType}:${citation.citation.recordId} is ${citation.status}.`)),
  ].sort((left, right) => left.localeCompare(right));
  return {
    ...canonical,
    intelligence: {
      integrity: { kind: integrity.kind, valid: integrity.valid, errors: [] },
      options,
      items,
      decisions,
      summary: { itemCount: items.length, decisionCount: decisions.length, staleExcludedCount },
      warnings,
    },
  };
}
