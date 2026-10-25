export const REPORT_LIFECYCLE_SCHEMA_VERSION = 1;
export const REPORT_CHECKSUM_FORMAT = "sha256-report-revision-content-v1";

export const REPORT_LIFECYCLE_STATES = Object.freeze([
  "draft",
  "in_review",
  "approved",
  "superseded",
  "withdrawn",
]);

export const REPORT_GENERATION_MODES = Object.freeze([
  "deterministic",
  "user_authored",
  "ai_assisted",
]);

export const REPORT_CITATION_RELATIONSHIPS = Object.freeze([
  "direct",
  "linked_context",
  "unresolved",
]);

export const REPORT_CLAIM_CLASSIFICATIONS = Object.freeze([
  "recorded_fact",
  "allegation",
  "observation",
  "interpretation",
  "unresolved_question",
  "recommended_action",
]);

const REPORT_RECORD_TYPES = new Set([
  "incident", "evidence", "document", "ledger", "strategy", "watch", "action", "goal", "party", "issue",
]);
const FORBIDDEN_BINARY_KEYS = new Set([
  "blob", "file", "dataurl", "backupdataurl", "base64", "binary", "buffer", "bytes",
]);
const TRANSITIONS = Object.freeze({
  draft: new Set(["in_review", "withdrawn"]),
  in_review: new Set(["draft", "approved", "withdrawn"]),
  approved: new Set(["superseded", "withdrawn"]),
  superseded: new Set(),
  withdrawn: new Set(),
});

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isIsoTimestamp(value) {
  return typeof value === "string" && value.trim() !== "" && !Number.isNaN(Date.parse(value));
}

function checksumValue(value) {
  return typeof value === "string" && new RegExp(`^${REPORT_CHECKSUM_FORMAT}:\\p{ASCII_Hex_Digit}{64}$`, "u").test(value);
}

function pushRequiredText(errors, value, label) {
  if (!text(value)) errors.push(`${label} is required.`);
}

function validateScope(scope, errors, label = "Scope") {
  if (!isPlainObject(scope)) {
    errors.push(`${label} must be an object.`);
    return;
  }
  if (scope.type === "case") return;
  if (scope.type === "issue") {
    pushRequiredText(errors, scope.issueId, `${label} Issue ID`);
    return;
  }
  errors.push(`${label} type must be case or issue.`);
}

function inspectCanonicalValue(value, path, errors, seen = new WeakSet()) {
  if (typeof value === "string" && /^data:/i.test(value.trim())) {
    errors.push(`${path} contains a data URL.`);
    return;
  }
  if (value === null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) errors.push(`${path} contains a non-finite number.`);
    return;
  }
  if (["undefined", "function", "symbol", "bigint"].includes(typeof value)) {
    errors.push(`${path} contains an unsupported value.`);
    return;
  }
  if (Array.isArray(value)) {
    if (seen.has(value)) {
      errors.push(`${path} contains a circular reference.`);
      return;
    }
    seen.add(value);
    value.forEach((item, index) => inspectCanonicalValue(item, `${path}[${index}]`, errors, seen));
    seen.delete(value);
    return;
  }
  if (!isPlainObject(value)) {
    errors.push(`${path} contains a non-plain object.`);
    return;
  }
  if (seen.has(value)) {
    errors.push(`${path} contains a circular reference.`);
    return;
  }
  seen.add(value);
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_BINARY_KEYS.has(key.toLocaleLowerCase())) errors.push(`${path}.${key} is a forbidden binary field.`);
    inspectCanonicalValue(child, `${path}.${key}`, errors, seen);
  }
  seen.delete(value);
}

function canonicalise(value) {
  if (value === null || typeof value === "string" || typeof value === "boolean" || typeof value === "number") return value;
  if (Array.isArray(value)) return value.map(canonicalise);
  const result = {};
  for (const key of Object.keys(value).sort()) result[key] = canonicalise(value[key]);
  return result;
}

function provenanceArray(value) {
  return Array.isArray(value) ? value : [];
}

export function validateReportCitation(citation) {
  const errors = [];
  if (!isPlainObject(citation)) return { valid: false, errors: ["Citation must be an object."] };
  if (!REPORT_RECORD_TYPES.has(citation.recordType)) errors.push("Citation record type is invalid.");
  pushRequiredText(errors, citation.recordId, "Citation record ID");
  if (citation.issueId != null && !text(citation.issueId)) errors.push("Citation Issue ID must be a non-empty string when supplied.");
  if (!REPORT_CITATION_RELATIONSHIPS.includes(citation.relationship)) errors.push("Citation relationship is invalid.");
  for (const key of ["recordReference", "recordTitle", "verificationStatus"]) {
    if (citation[key] != null && !text(citation[key])) errors.push(`Citation ${key} must be a non-empty string when supplied.`);
  }
  inspectCanonicalValue(citation, "citation", errors);
  return { valid: errors.length === 0, errors };
}

export function validateReportClaim(claim) {
  const errors = [];
  if (!isPlainObject(claim)) return { valid: false, errors: ["Claim must be an object."] };
  if (!REPORT_CLAIM_CLASSIFICATIONS.includes(claim.classification)) errors.push("Claim classification is invalid.");
  if (claim.id != null && !text(claim.id)) errors.push("Claim ID must be a non-empty string when supplied.");
  if (claim.citationIds != null && (!Array.isArray(claim.citationIds) || claim.citationIds.some((id) => !text(id)))) {
    errors.push("Claim citation IDs must be an array of non-empty strings when supplied.");
  }
  inspectCanonicalValue(claim, "claim", errors);
  return { valid: errors.length === 0, errors };
}

export function validateReportProvenance(provenance) {
  const errors = [];
  if (!isPlainObject(provenance)) return { valid: false, errors: ["Provenance must be an object."] };
  if (!Array.isArray(provenance.citations)) errors.push("Provenance citations must be an array.");
  if (!Array.isArray(provenance.claims)) errors.push("Provenance claims must be an array.");
  const citationIds = new Set();
  for (const citation of provenanceArray(provenance.citations)) {
    const result = validateReportCitation(citation);
    errors.push(...result.errors);
    if (text(citation?.id)) {
      if (citationIds.has(citation.id)) errors.push(`Duplicate citation ID: ${citation.id}.`);
      citationIds.add(citation.id);
    }
  }
  for (const claim of provenanceArray(provenance.claims)) {
    const result = validateReportClaim(claim);
    errors.push(...result.errors);
    for (const citationId of Array.isArray(claim?.citationIds) ? claim.citationIds : []) {
      if (!citationIds.has(citationId)) errors.push(`Claim references an unavailable citation ID: ${citationId}.`);
    }
  }
  inspectCanonicalValue(provenance, "provenance", errors);
  return { valid: errors.length === 0, errors };
}

export function validateReportManifest(manifest) {
  const errors = [];
  if (!isPlainObject(manifest)) return { valid: false, errors: ["Report manifest must be an object."] };
  if (manifest.schemaVersion !== REPORT_LIFECYCLE_SCHEMA_VERSION) errors.push("Unsupported or missing report lifecycle schema version.");
  for (const [value, label] of [[manifest.id, "Report ID"], [manifest.caseId, "Case ID"], [manifest.reportType, "Report type"], [manifest.title, "Report title"], [manifest.currentRevisionId, "Current revision ID"]]) pushRequiredText(errors, value, label);
  if (!isIsoTimestamp(manifest.createdAt)) errors.push("Report creation timestamp is invalid.");
  validateScope(manifest.scope, errors);
  if (!REPORT_LIFECYCLE_STATES.includes(manifest.status)) errors.push("Report lifecycle status is invalid.");
  if (manifest.approvedRevisionId != null && !text(manifest.approvedRevisionId)) errors.push("Approved revision ID must be a non-empty string when supplied.");
  if (!Array.isArray(manifest.revisionIds) || manifest.revisionIds.some((id) => !text(id))) errors.push("Revision IDs must be an array of non-empty strings.");
  else {
    const uniqueIds = new Set(manifest.revisionIds);
    if (uniqueIds.size !== manifest.revisionIds.length) errors.push("Revision IDs must be unique.");
    if (text(manifest.currentRevisionId) && !uniqueIds.has(manifest.currentRevisionId)) errors.push("Current revision ID must be listed in revision IDs.");
    if (text(manifest.approvedRevisionId) && !uniqueIds.has(manifest.approvedRevisionId)) errors.push("Approved revision ID must be listed in revision IDs.");
  }
  if (manifest.status === "approved" && manifest.approvedRevisionId !== manifest.currentRevisionId) errors.push("An approved report must identify its current approved revision.");
  inspectCanonicalValue(manifest, "manifest", errors);
  return { valid: errors.length === 0, errors };
}

export function buildReportRevisionChecksumPayload(revision) {
  const result = validateReportRevision({ ...revision, contentChecksum: revision?.contentChecksum || `${REPORT_CHECKSUM_FORMAT}:${"0".repeat(64)}` });
  if (!result.valid) throw new TypeError(`Invalid report revision: ${result.errors.join(" ")}`);
  return {
    checksumFormat: REPORT_CHECKSUM_FORMAT,
    reportId: revision.reportId,
    versionNumber: revision.versionNumber,
    parentRevisionId: revision.parentRevisionId || null,
    createdAt: revision.createdAt,
    source: {
      caseRevision: revision.source.caseRevision,
      fingerprint: revision.source.fingerprint,
    },
    content: revision.content,
    generationMode: revision.generationMode,
    provenance: revision.provenance,
  };
}

export function canonicalSerialiseReportRevisionContent(value) {
  const errors = [];
  inspectCanonicalValue(value, "revisionContent", errors);
  if (errors.length) throw new TypeError(`Cannot canonicalise report revision content: ${errors.join(" ")}`);
  return JSON.stringify(canonicalise(value));
}

export async function calculateReportRevisionChecksum(revision) {
  const payload = buildReportRevisionChecksumPayload(revision);
  if (!globalThis.crypto?.subtle) throw new Error("Web Crypto SHA-256 is unavailable.");
  const bytes = new TextEncoder().encode(canonicalSerialiseReportRevisionContent(payload));
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  const hexadecimal = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${REPORT_CHECKSUM_FORMAT}:${hexadecimal}`;
}

export async function verifyReportRevisionChecksum(revision) {
  const validation = validateReportRevision(revision);
  if (!validation.valid) return { valid: false, errors: validation.errors };
  const expected = await calculateReportRevisionChecksum(revision);
  return expected === revision.contentChecksum
    ? { valid: true, errors: [] }
    : { valid: false, errors: ["Report revision checksum does not match immutable revision content."] };
}

export function validateReportRevision(revision) {
  const errors = [];
  if (!isPlainObject(revision)) return { valid: false, errors: ["Report revision must be an object."] };
  if (revision.schemaVersion !== REPORT_LIFECYCLE_SCHEMA_VERSION) errors.push("Unsupported or missing report lifecycle schema version.");
  for (const [value, label] of [[revision.id, "Revision ID"], [revision.reportId, "Parent report ID"]]) pushRequiredText(errors, value, label);
  if (!Number.isSafeInteger(revision.versionNumber) || revision.versionNumber < 1) errors.push("Revision version number must be a positive integer.");
  if (revision.parentRevisionId != null && !text(revision.parentRevisionId)) errors.push("Parent revision ID must be a non-empty string when supplied.");
  if (!isIsoTimestamp(revision.createdAt)) errors.push("Revision creation timestamp is invalid.");
  if (!isPlainObject(revision.source)) errors.push("Revision source must be an object.");
  else {
    if (!Number.isSafeInteger(revision.source.caseRevision) || revision.source.caseRevision < 1) errors.push("Source case revision must be a positive integer.");
    pushRequiredText(errors, revision.source.fingerprint, "Source report fingerprint");
  }
  if (!isPlainObject(revision.content)) errors.push("Revision content must be a structured object.");
  if (!REPORT_GENERATION_MODES.includes(revision.generationMode)) errors.push("Revision generation mode is invalid.");
  const provenance = validateReportProvenance(revision.provenance);
  errors.push(...provenance.errors);
  if (!checksumValue(revision.contentChecksum)) errors.push(`Content checksum must use ${REPORT_CHECKSUM_FORMAT}.`);
  inspectCanonicalValue(revision, "revision", errors);
  return { valid: errors.length === 0, errors };
}

export function getReportSourceFreshness(revisionOrFingerprint, currentFingerprint) {
  const savedFingerprint = typeof revisionOrFingerprint === "string"
    ? text(revisionOrFingerprint)
    : text(revisionOrFingerprint?.source?.fingerprint);
  const current = text(currentFingerprint);
  if (!savedFingerprint || !current) return "unknown";
  return savedFingerprint === current ? "current" : "stale";
}

export function canApproveReportRevision(revision, currentFingerprint) {
  const validation = validateReportRevision(revision);
  if (!validation.valid) return { eligible: false, reason: "invalid_revision", errors: validation.errors };
  const freshness = getReportSourceFreshness(revision, currentFingerprint);
  return freshness === "current"
    ? { eligible: true, freshness, errors: [] }
    : { eligible: false, freshness, reason: "source_not_current", errors: ["Report approval requires a current source fingerprint."] };
}

export function canTransitionReportLifecycle(fromStatus, toStatus) {
  return REPORT_LIFECYCLE_STATES.includes(fromStatus)
    && REPORT_LIFECYCLE_STATES.includes(toStatus)
    && TRANSITIONS[fromStatus].has(toStatus);
}

export function transitionReportLifecycle(lifecycle, toStatus, { actor, currentFingerprint, at } = {}) {
  if (!isPlainObject(lifecycle) || !REPORT_LIFECYCLE_STATES.includes(lifecycle.status)) {
    return { ok: false, errors: ["Current lifecycle status is invalid."] };
  }
  if (!canTransitionReportLifecycle(lifecycle.status, toStatus)) {
    return { ok: false, errors: [`Invalid report lifecycle transition: ${lifecycle.status} to ${toStatus}.`] };
  }
  if (toStatus === "approved") {
    if (actor?.kind !== "human" || !text(actor.name)) return { ok: false, errors: ["Approval requires a named local human reviewer."] };
    const approval = canApproveReportRevision(lifecycle.revision, currentFingerprint);
    if (!approval.eligible) return { ok: false, errors: approval.errors, freshness: approval.freshness || "unknown" };
  }
  const transitionedAt = at || new Date().toISOString();
  if (!isIsoTimestamp(transitionedAt)) return { ok: false, errors: ["Lifecycle transition timestamp is invalid."] };
  const next = {
    ...lifecycle,
    status: toStatus,
    updatedAt: transitionedAt,
    review: { ...(isPlainObject(lifecycle.review) ? lifecycle.review : {}) },
  };
  if (toStatus === "in_review") next.review.submittedAt = transitionedAt;
  if (toStatus === "approved") {
    next.review.reviewedBy = text(actor.name);
    next.review.reviewedAt = transitionedAt;
  }
  return { ok: true, lifecycle: next };
}

export function findReportRevisionConflicts(existingRevisions, incomingRevisions) {
  const existing = new Map((Array.isArray(existingRevisions) ? existingRevisions : [])
    .filter((revision) => text(revision?.id))
    .map((revision) => [revision.id, revision]));
  const conflicts = [];
  const matchingRevisionIds = [];
  for (const revision of Array.isArray(incomingRevisions) ? incomingRevisions : []) {
    if (!text(revision?.id) || !existing.has(revision.id)) continue;
    const current = existing.get(revision.id);
    if (text(current.contentChecksum) !== text(revision.contentChecksum)) {
      conflicts.push({ revisionId: revision.id, existingChecksum: text(current.contentChecksum), incomingChecksum: text(revision.contentChecksum) });
    } else {
      matchingRevisionIds.push(revision.id);
    }
  }
  return { hasConflicts: conflicts.length > 0, conflicts, matchingRevisionIds };
}
