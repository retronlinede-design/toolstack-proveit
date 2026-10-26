import { buildActiveReportDocument } from "./buildActiveReportDocument.js";
import { getReportDefinition } from "./reportDefinitions.js";
import { buildCaseReportModel, createReportIssueMembershipResolver } from "./reportModel.js";

export const AI_BRIEF_SCHEMA_ID = "proveit.ai-brief";
export const AI_BRIEF_SCHEMA_VERSION = 1;

const TECHNICAL_SOURCES = Object.freeze({
  incidentSchedule: { label: "Incident Schedule", recordTypes: ["incident"] },
  evidence: { label: "Evidence Schedule", recordTypes: ["evidence"] },
  document: { label: "Document Schedule", recordTypes: ["document"] },
  ledger: { label: "Ledger Schedule", recordTypes: ["ledger"] },
  chronologyReport: { label: "Chronology", recordTypes: ["incident", "evidence", "document", "ledger", "strategy", "watch"] },
  caseAudit: { label: "Case Quality Audit", recordTypes: ["incident", "evidence", "document", "ledger", "strategy", "watch"] },
  action: { label: "Operational Brief", recordTypes: ["strategy", "watch"] },
});

const FAMILY_SOURCE_SELECTION = Object.freeze({
  executive: ["incidentSchedule", "evidence", "chronologyReport", "caseAudit", "action"],
  management: ["incidentSchedule", "evidence", "document", "ledger", "chronologyReport", "caseAudit", "action"],
  investigation: ["incidentSchedule", "evidence", "document", "ledger", "chronologyReport", "caseAudit", "action"],
  client: ["incidentSchedule", "evidence", "document", "ledger", "chronologyReport", "caseAudit", "action"],
});

const FORBIDDEN_KEYS = new Set(["blob", "file", "dataurl", "backupdataurl", "base64", "binary", "buffer", "bytes"]);
const RECORD_COLLECTIONS = Object.freeze({ incident: "incidents", evidence: "evidence", document: "documents", ledger: "ledger", strategy: "strategy", watch: "watchItems" });

function text(value) { return typeof value === "string" ? value.trim() : ""; }
function plainObject(value) { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
function recordKey(record) { return `${record.type}:${record.id}`; }

function assertSafe(value, path = "brief", seen = new WeakSet()) {
  if (typeof value === "string" && /^data:/i.test(value.trim())) throw new TypeError(`${path} contains a data URL.`);
  if (value == null || ["string", "number", "boolean"].includes(typeof value)) return;
  if (typeof value !== "object" || seen.has(value)) throw new TypeError(`${path} contains an unsupported or circular value.`);
  seen.add(value);
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.has(key.toLocaleLowerCase())) throw new TypeError(`${path}.${key} is a forbidden binary field.`);
    assertSafe(child, `${path}.${key}`, seen);
  }
  seen.delete(value);
}

function modelMembership(model, caseData) {
  const records = model.records?.all || [];
  const source = {
    issues: (model.sequenceGroups || []).filter((issue) => issue.issueId).map((issue) => ({ id: issue.issueId, name: issue.name })),
    retiredIssues: Array.isArray(caseData?.retiredIssues) ? caseData.retiredIssues : [],
  };
  for (const [type, collection] of Object.entries(RECORD_COLLECTIONS)) source[collection] = records.filter((record) => record.type === type);
  const resolver = createReportIssueMembershipResolver(source);
  const groups = new Map((model.sequenceGroups || []).filter((issue) => issue.issueId).map((issue) => [issue.issueId, issue]));
  return {
    resolve(record) {
      const result = resolver.resolve(record);
      return { ...result, group: result.kind === "canonical" ? groups.get(result.issue.id) || null : null };
    },
  };
}

function issueAssociation(record, membership) {
  const resolved = membership.resolve(record);
  if (resolved.group) return { resolution: resolved.legacyFallback ? "legacy-name" : "canonical", issueId: resolved.group.issueId, reference: resolved.group.issueReference || "", name: resolved.group.name, label: resolved.group.displayLabel };
  if (resolved.kind === "legacy") return { resolution: "legacy-unregistered", issueId: null, reference: "", name: resolved.name || record.sequenceGroup || "", label: resolved.name || record.sequenceGroup || "" };
  return { resolution: resolved.kind, issueId: null, reference: "", name: "", label: "" };
}

function sourceIdsForRecord(record, includedSourceIds) {
  return includedSourceIds.filter((sourceId) => TECHNICAL_SOURCES[sourceId].recordTypes.includes(record.type)).sort();
}

function recordReference(record, scopeRelation, membership, includedSourceIds, unresolvedReferences) {
  const verificationStatus = text(record.details?.verificationStatus) || text(record.details?.proofStatus) || "unknown";
  return {
    recordType: record.type,
    recordId: record.id,
    title: record.title,
    scopeRelation,
    issue: issueAssociation(record, membership),
    status: record.status || "unknown",
    verificationStatus,
    archived: record.archived === true,
    date: record.canonicalDate || "",
    dateStatus: record.dateStatus || "missing",
    summary: record.summary || "",
    relationshipContext: (record.links || []).map((link) => ({ targetId: link.targetId, targetType: link.targetType || "unknown", referenceType: link.referenceType, status: link.status })).sort((a, b) => `${a.targetType}:${a.targetId}:${a.referenceType}`.localeCompare(`${b.targetType}:${b.targetId}:${b.referenceType}`)),
    unresolvedReferences: unresolvedReferences.filter((item) => item.sourceRecordId === record.id && item.sourceRecordType === record.type).map((item) => ({ targetId: item.targetId, referenceType: item.referenceType, message: item.message })),
    sourceTechnicalReportIds: sourceIdsForRecord(record, includedSourceIds),
  };
}

function technicalSourceMetadata(document) {
  return {
    report: { id: document.report?.id || "", title: document.report?.title || "", audience: document.report?.audience || "", completeness: document.report?.completeness || "" },
    source: { caseId: document.source?.caseId || "", sourceRevision: document.source?.sourceRevision || null, scope: document.source?.scope || null },
    notices: (document.notices || []).map(({ code, severity, message }) => ({ code, severity, message })),
  };
}

function selectedTechnicalSources(model, family) {
  const included = FAMILY_SOURCE_SELECTION[family];
  return Object.entries(TECHNICAL_SOURCES).map(([id, source]) => {
    const selected = included.includes(id);
    if (!selected) return { id, label: source.label, included: false, reason: `Not required for the ${family} brief.`, recordTypes: source.recordTypes };
    const document = buildActiveReportDocument({ reportId: id, reportModel: model, definition: getReportDefinition(id), generatedAt: model.generatedAt }).reportDocument;
    return { id, label: source.label, included: true, reason: `Selected for the ${family} brief.`, recordTypes: source.recordTypes, metadata: technicalSourceMetadata(document) };
  });
}

export function buildAiBrief(caseData, { reportFamily, scope = "case", issueId = "", sequenceGroupName = "", generatedAt = "", createdAt = "", schemaVersion = AI_BRIEF_SCHEMA_VERSION } = {}) {
  if (!plainObject(caseData)) throw new TypeError("AI Brief requires a case object.");
  if (!text(caseData.id)) throw new TypeError("AI Brief requires a canonical case ID.");
  if (!Object.hasOwn(FAMILY_SOURCE_SELECTION, reportFamily)) throw new TypeError("AI Brief requires a supported professional report family.");
  if (schemaVersion !== AI_BRIEF_SCHEMA_VERSION) throw new TypeError("Unsupported AI Brief schema version.");
  if (!["case", "sequenceGroup"].includes(scope)) throw new TypeError("AI Brief scope must be case or sequenceGroup.");
  if (scope === "sequenceGroup" && !text(issueId) && !text(sequenceGroupName)) throw new TypeError("An Issue-scoped AI Brief requires an Issue ID or uniquely resolvable legacy Issue name.");
  const deterministicGeneratedAt = text(generatedAt) || text(caseData.updatedAt) || "1970-01-01T00:00:00.000Z";
  const model = buildCaseReportModel(caseData, { scope, issueId, sequenceGroupName, generatedAt: deterministicGeneratedAt, includeArchived: true, includeDiagnostics: true });
  if (model.scope?.isValid === false) throw new TypeError("The requested AI Brief Issue scope is unavailable or invalid.");
  const technicalSources = selectedTechnicalSources(model, reportFamily);
  const includedSourceIds = technicalSources.filter((source) => source.included).map((source) => source.id);
  const direct = model.records?.primaryScopedRecords || [];
  const directKeys = new Set(direct.map(recordKey));
  const directIds = new Set(direct.map((record) => record.id));
  const linkedContext = (model.records?.all || []).filter((record) => !directKeys.has(recordKey(record)) && (direct.some((primary) => (primary.links || []).some((link) => link.status === "resolved" && link.targetId === record.id)) || (record.links || []).some((link) => link.status === "resolved" && directIds.has(link.targetId))));
  const membership = modelMembership(model, caseData);
  const unresolved = model.unresolvedReferences || [];
  const references = [
    ...direct.map((record) => recordReference(record, "direct", membership, includedSourceIds, unresolved)),
    ...linkedContext.map((record) => recordReference(record, "linked_context", membership, includedSourceIds, unresolved)),
  ].sort((a, b) => `${a.recordType}:${a.recordId}`.localeCompare(`${b.recordType}:${b.recordId}`));
  const brief = {
    schema: { id: AI_BRIEF_SCHEMA_ID, version: AI_BRIEF_SCHEMA_VERSION },
    requestedReportFamily: reportFamily,
    case: { id: model.sourceCase.id, name: model.sourceCase.name, status: model.sourceCase.status, category: model.sourceCase.category },
    scope: model.scope.type === "sequenceGroup" ? { type: "issue", issueId: model.scope.issueId || null, issueReference: model.scope.issueReference || "", issueName: model.scope.issueName || model.scope.sequenceGroupName || "", label: model.scope.displayLabel || "", resolution: model.scope.issueId ? "canonical" : "legacy-name" } : { type: "case", label: "Whole case" },
    source: { caseRevision: model.sourceRevision.caseUpdatedAt || "", sourceFingerprint: model.sourceRevision.fingerprint, recordCount: model.sourceRevision.recordCount },
    technicalSources,
    recordReferences: references,
    diagnostics: { unresolvedReferences: unresolved.map((item) => ({ sourceRecordType: item.sourceRecordType, sourceRecordId: item.sourceRecordId, targetId: item.targetId, referenceType: item.referenceType, message: item.message })), case: model.diagnostics?.case || null, coverageNote: model.diagnostics?.records?.coverageNote || "" },
    limitations: ["Technical source documents and references are derived from recorded case data; they do not establish allegations as facts.", "Attachment binaries, data URLs, credentials, local file paths, and application secrets are excluded.", "Verification and status values are preserved as recorded; missing values remain unknown.", "This AI Brief contains source material only. It does not contain an AI-generated narrative or transmit data externally."],
    generationMetadata: { deterministicSourceContent: true, createdAt: text(createdAt) || null },
  };
  assertSafe(brief);
  return brief;
}

export function validateAiBrief(brief) {
  const errors = [];
  if (!plainObject(brief)) errors.push("AI Brief must be an object.");
  if (brief?.schema?.id !== AI_BRIEF_SCHEMA_ID || brief?.schema?.version !== AI_BRIEF_SCHEMA_VERSION) errors.push("AI Brief schema is unsupported.");
  if (!text(brief?.case?.id)) errors.push("AI Brief case ID is required.");
  if (!Object.hasOwn(FAMILY_SOURCE_SELECTION, brief?.requestedReportFamily)) errors.push("AI Brief report family is unsupported.");
  if (!Array.isArray(brief?.technicalSources) || !Array.isArray(brief?.recordReferences)) errors.push("AI Brief sources and references must be arrays.");
  try { assertSafe(brief); } catch (error) { errors.push(error.message); }
  return { valid: errors.length === 0, errors };
}

export function getAiBriefFreshness(brief, caseData) {
  if (!plainObject(caseData) || brief?.case?.id !== caseData.id || !validateAiBrief(brief).valid) return "unknown";
  const scope = brief.scope?.type === "issue" ? "sequenceGroup" : brief.scope?.type === "case" ? "case" : "";
  if (!scope) return "unknown";
  const model = buildCaseReportModel(caseData, {
    scope,
    issueId: scope === "sequenceGroup" ? brief.scope.issueId || "" : "",
    sequenceGroupName: "",
    includeArchived: true,
    includeDiagnostics: true,
  });
  if (model.scope?.isValid === false) return "unknown";
  const preparedRevision = text(brief.source?.caseRevision);
  const currentRevision = text(model.sourceRevision?.caseUpdatedAt);
  const preparedFingerprint = text(brief.source?.sourceFingerprint);
  const currentFingerprint = text(model.sourceRevision?.fingerprint);
  if (!preparedRevision || !currentRevision || !preparedFingerprint || !currentFingerprint) return "unknown";
  return preparedRevision === currentRevision && preparedFingerprint === currentFingerprint ? "current" : "stale";
}
