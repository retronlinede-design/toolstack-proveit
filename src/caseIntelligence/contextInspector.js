import { buildAiWorkspaceCaseProjection } from "../export/aiWorkspaceProjection.js";
import { buildCaseReportModel, createReportIssueMembershipResolver } from "../report/reportModel.js";

export const CASE_INTELLIGENCE_CONTEXT_SCHEMA_ID = "proveit.case-intelligence-context";
export const CASE_INTELLIGENCE_CONTEXT_SCHEMA_VERSION = 1;

const COLLECTIONS = Object.freeze([
  ["issues", "issue"], ["parties", "party"], ["incidents", "incident"], ["evidence", "evidence"],
  ["documents", "document"], ["ledger", "ledger"], ["tasks", "task"], ["strategy", "strategy"],
  ["watchItems", "watch"], ["goals", "goal"],
]);
const FORBIDDEN_KEYS = new Set(["blob", "file", "dataurl", "backupdataurl", "base64", "binary", "buffer", "bytes", "pin", "password", "credential", "secret", "storage", "localpath", "filepath"]);

function text(value) { return typeof value === "string" ? value.trim() : ""; }
function list(value) { return Array.isArray(value) ? value : []; }
function key(type, id) { return `${type}:${id}`; }
function titleFor(record, type) { return text(record?.title) || text(record?.label) || text(record?.displayName) || text(record?.name) || `${type} ${text(record?.id)}`; }
function stableSort(records) { return [...records].sort((left, right) => titleFor(left.record, left.recordType).localeCompare(titleFor(right.record, right.recordType)) || left.recordId.localeCompare(right.recordId)); }

function safeValue(value, exclusions, path = "context") {
  if (typeof value === "string") {
    if (/^data:/i.test(value.trim())) {
      exclusions.unsupportedSourceContent.push({ path, reason: "data_url_excluded" });
      return undefined;
    }
    return value;
  }
  if (value == null || ["number", "boolean"].includes(typeof value)) return value;
  if (Array.isArray(value)) return value.map((item, index) => safeValue(item, exclusions, `${path}[${index}]`)).filter((item) => item !== undefined);
  if (typeof value !== "object") return undefined;
  const output = {};
  Object.entries(value).forEach(([name, child]) => {
    if (FORBIDDEN_KEYS.has(name.toLowerCase())) {
      exclusions.unsupportedSourceContent.push({ path: `${path}.${name}`, reason: "forbidden_field_excluded" });
      return;
    }
    const safeChild = safeValue(child, exclusions, `${path}.${name}`);
    if (safeChild !== undefined) output[name] = safeChild;
  });
  return output;
}

function issueAssociation(record, resolver) {
  const resolved = resolver.resolve(record);
  if (resolved.kind === "canonical") return {
    resolution: resolved.legacyFallback ? "legacy-name" : "canonical",
    issueId: resolved.issue.id,
    reference: text(resolved.issue.reference),
    name: text(resolved.issue.name),
    label: [text(resolved.issue.reference), text(resolved.issue.name)].filter(Boolean).join(" — "),
  };
  if (resolved.kind === "legacy") return { resolution: "legacy-unregistered", issueId: null, reference: "", name: text(resolved.name), label: text(resolved.name) };
  return { resolution: resolved.kind, issueId: null, reference: "", name: "", label: "" };
}

function recordHasIssue(record, association, issueId) {
  return association.issueId === issueId || list(record.issueIds).includes(issueId);
}

function attachmentIds(record) {
  const attachments = [...list(record.attachments), ...list(record.availability?.digital?.files)];
  return attachments.map((item, index) => text(item?.id) || `${text(item?.name)}:${index}`).filter(Boolean);
}

function relationTuple(reference) {
  return [reference.sourceType, reference.sourceId, reference.field, reference.targetType, reference.targetId].join(":");
}

function relationshipDetails(descriptor, relationships, byId) {
  const seen = new Set();
  const resolved = [];
  const unresolved = [];
  [...relationships.resolvedReferences, ...relationships.unresolvedReferences].forEach((reference) => {
    if (reference.sourceType !== descriptor.recordType || reference.sourceId !== descriptor.recordId) return;
    const tuple = relationTuple(reference);
    if (seen.has(tuple)) return;
    seen.add(tuple);
    const target = byId.get(reference.targetId);
    if (reference.resolved && target?.length === 1) {
      resolved.push({ field: reference.field, targetId: reference.targetId, targetType: target[0].recordType, targetLabel: target[0].displayLabel });
    } else {
      unresolved.push({ field: reference.field, targetId: reference.targetId, targetType: reference.targetType || "record", message: reference.resolved ? "Target record identity is ambiguous." : "Target record is unavailable." });
    }
  });
  return { resolved, unresolved };
}

function buildDescriptors(projection, resolver, exclusions, sourceCase) {
  const descriptors = [];
  COLLECTIONS.forEach(([collection, recordType]) => {
    list(projection.canonical?.[collection]).forEach((record) => {
      const safeRecord = safeValue(record, exclusions, `canonical.${collection}.${text(record?.id)}`);
      if (!text(safeRecord?.id)) return;
      // Goal projection supplies UI timestamps when old records lack them. The
      // Inspector must remain factual and deterministic, so retain only the
      // originally stored values for this historical compatibility case.
      if (collection === "goals") {
        const sourceGoal = list(sourceCase?.goals).find((item) => item?.id === safeRecord.id) || {};
        ["createdAt", "updatedAt"].forEach((field) => {
          if (text(sourceGoal[field])) safeRecord[field] = text(sourceGoal[field]);
          else delete safeRecord[field];
        });
      }
      descriptors.push({
        recordType,
        recordId: safeRecord.id,
        displayLabel: titleFor(safeRecord, recordType),
        record: safeRecord,
        issue: recordType === "issue" ? { resolution: "canonical", issueId: safeRecord.id, reference: safeRecord.reference || "", name: safeRecord.name || "", label: [safeRecord.reference, safeRecord.name].filter(Boolean).join(" — ") } : issueAssociation(record, resolver),
      });
    });
  });
  return descriptors;
}

function scopedDescriptors(descriptors, relationships, issueId) {
  if (!issueId) return { direct: descriptors, linked: [] };
  const direct = descriptors.filter((item) => item.recordType === "issue" ? item.recordId === issueId : recordHasIssue(item.record, item.issue, issueId));
  const directKeys = new Set(direct.map((item) => key(item.recordType, item.recordId)));
  const directIds = new Set(direct.map((item) => item.recordId));
  const linkedIds = new Set();
  relationships.resolvedReferences.forEach((reference) => {
    const sourceKey = key(reference.sourceType, reference.sourceId);
    if (directKeys.has(sourceKey)) linkedIds.add(reference.targetId);
    if (directIds.has(reference.targetId)) linkedIds.add(reference.sourceId);
  });
  const linked = descriptors.filter((item) => !directKeys.has(key(item.recordType, item.recordId)) && linkedIds.has(item.recordId));
  return { direct, linked };
}

function groupedInventory(direct, linked, relationships) {
  const all = [...direct.map((item) => ({ ...item, scopeRelation: "direct" })), ...linked.map((item) => ({ ...item, scopeRelation: "linked_context" }))];
  const byId = new Map();
  all.forEach((item) => {
    const values = byId.get(item.recordId) || [];
    values.push(item);
    byId.set(item.recordId, values);
  });
  const map = Object.fromEntries(COLLECTIONS.map(([collection]) => [collection, []]));
  stableSort(all).forEach((item) => {
    const collection = COLLECTIONS.find(([, type]) => type === item.recordType)?.[0];
    if (!collection) return;
    const details = relationshipDetails(item, relationships, byId);
    map[collection].push({
      recordType: item.recordType,
      recordId: item.recordId,
      displayLabel: item.displayLabel,
      scopeRelation: item.scopeRelation,
      issue: item.issue,
      authority: item.record.authority || "canonical_stored_case_data",
      record: item.record,
      relationships: details,
    });
  });
  return map;
}

export function buildCaseIntelligenceContext(caseData, { scope = "case", issueId = "", generatedAt = "" } = {}) {
  if (!caseData || typeof caseData !== "object" || !text(caseData.id)) throw new TypeError("Case Intelligence Context requires a canonical case ID.");
  if (!["case", "issue"].includes(scope)) throw new TypeError("Context scope must be case or issue.");
  const projection = buildAiWorkspaceCaseProjection(caseData, { exportedAt: text(generatedAt) || text(caseData.updatedAt) || "1970-01-01T00:00:00.000Z" });
  const model = buildCaseReportModel(caseData, {
    scope: scope === "issue" ? "sequenceGroup" : "case",
    issueId: scope === "issue" ? text(issueId) : "",
    includeArchived: true,
    includeDiagnostics: true,
    generatedAt: text(generatedAt) || text(caseData.updatedAt) || "1970-01-01T00:00:00.000Z",
  });
  const exclusions = { unsupportedSourceContent: [] };
  const resolver = createReportIssueMembershipResolver(caseData);
  const descriptors = buildDescriptors(projection, resolver, exclusions, caseData);
  const scopeValid = scope === "case" || model.scope?.isValid === true;
  const selectedIssue = scopeValid && scope === "issue" ? descriptorForIssue(descriptors, model.scope.issueId) : null;
  const selected = scopeValid ? scopedDescriptors(descriptors, projection.derived.relationships, scope === "issue" ? model.scope.issueId : "") : { direct: [], linked: [] };
  const inventory = groupedInventory(selected.direct, selected.linked, projection.derived.relationships);
  const allInventory = Object.values(inventory).flat();
  const attachmentIds = new Set(allInventory.flatMap((item) => attachmentIdsForContext(item.record)));
  const includedScopeKeys = new Set(allInventory.map((item) => key(item.recordType, item.recordId)));
  const unresolvedByTuple = new Map();
  projection.derived.relationships.unresolvedReferences
    .filter((reference) => scope === "case" || includedScopeKeys.has(key(reference.sourceType, reference.sourceId)))
    .forEach((reference) => unresolvedByTuple.set(relationTuple(reference), reference));
  const unresolved = [...unresolvedByTuple.values()].sort((left, right) => relationTuple(left).localeCompare(relationTuple(right)));
  const ambiguous = allInventory.filter((item) => item.issue.resolution === "ambiguous-legacy-name").map((item) => ({ recordType: item.recordType, recordId: item.recordId, displayLabel: item.displayLabel, resolution: item.issue.resolution }));
  const warning = scope === "issue" && !scopeValid
    ? (text(issueId) ? "Selected Issue is unavailable or invalid. No context has been substituted." : "Choose an Issue to inspect Issue-scoped context.")
    : "";
  return {
    schema: { id: CASE_INTELLIGENCE_CONTEXT_SCHEMA_ID, version: CASE_INTELLIGENCE_CONTEXT_SCHEMA_VERSION },
    generatedAt: projection.exportedAt,
    readOnly: true,
    localOnly: true,
    source: { caseId: projection.case.id, caseRevision: caseData.revision ?? null, caseUpdatedAt: model.sourceRevision.caseUpdatedAt || "", sourceFingerprint: model.sourceRevision.fingerprint, recordCount: model.sourceRevision.recordCount },
    scope: scope === "issue" ? { type: "issue", issueId: scopeValid ? model.scope.issueId || null : text(issueId) || null, issueReference: selectedIssue?.record.reference || "", issueName: selectedIssue?.record.name || "", label: scopeValid ? (model.scope.displayLabel || selectedIssue?.displayLabel || "Selected Issue") : "Selected Issue unavailable", valid: scopeValid, warning } : { type: "case", issueId: null, issueReference: "", issueName: "", label: "Entire Case", valid: true, warning: "" },
    inventory,
    context: {
      directRecordRefs: allInventory.filter((item) => item.scopeRelation === "direct").map(({ recordType, recordId, displayLabel, issue }) => ({ recordType, recordId, displayLabel, issue })),
      linkedRecordRefs: allInventory.filter((item) => item.scopeRelation === "linked_context").map(({ recordType, recordId, displayLabel, issue }) => ({ recordType, recordId, displayLabel, issue })),
      unresolvedReferences: unresolved,
      ambiguousAssociations: ambiguous,
    },
    attachmentSummary: { attachmentMetadataCount: attachmentIds.size, excludedBinaryCount: attachmentIds.size, unsupportedSourceContent: exclusions.unsupportedSourceContent },
    totals: { directByType: countByType(allInventory, "direct"), linkedByType: countByType(allInventory, "linked_context"), unresolvedReferenceCount: unresolved.length, excludedAttachmentCount: attachmentIds.size },
    exclusions: { categories: ["binary_attachment_payloads", "data_urls", "credentials_and_locks", "local_file_paths", "audit_history", "backup_or_import_state", "cache_storage_details"] },
  };
}

function descriptorForIssue(descriptors, issueId) { return descriptors.find((item) => item.recordType === "issue" && item.recordId === issueId) || null; }
function attachmentIdsForContext(record) { return attachmentIds(record); }
function countByType(inventory, scopeRelation) {
  return Object.fromEntries(COLLECTIONS.map(([, type]) => [type, inventory.filter((item) => item.recordType === type && item.scopeRelation === scopeRelation).length]));
}

export function getCaseIntelligenceContextFreshness(context, caseData) {
  if (!context || !caseData || context.source?.caseId !== caseData.id) return "unknown";
  try {
    const current = buildCaseIntelligenceContext(caseData, { scope: context.scope?.type === "issue" ? "issue" : "case", issueId: context.scope?.issueId || "" });
    if (!current.scope.valid || !context.scope?.valid) return "unknown";
    const revisionMatches = context.source.caseRevision == null || current.source.caseRevision == null || context.source.caseRevision === current.source.caseRevision;
    return revisionMatches && context.source.sourceFingerprint === current.source.sourceFingerprint ? "current" : "stale";
  } catch {
    return "unknown";
  }
}
