import { validateAiBrief } from "./aiBrief.js";
import { REPORT_CLAIM_CLASSIFICATIONS } from "./reportLifecycle.js";

export const AI_DRAFT_SCHEMA_ID = "proveit.ai-draft";
export const AI_DRAFT_SCHEMA_VERSION = 1;
export const AI_DRAFT_MAX_BYTES = 750_000;

const PROFESSIONAL_FAMILIES = new Set(["executive", "management", "investigation", "client"]);
const FORBIDDEN_KEYS = new Set(["blob", "file", "dataurl", "backupdataurl", "base64", "binary", "buffer", "bytes", "__proto__", "prototype", "constructor"]);
const MAX_COLLECTION_LENGTH = 200;
const MAX_TEXT_LENGTH = 24_000;

function text(value) { return typeof value === "string" ? value.trim() : ""; }
function object(value) { return Boolean(value) && typeof value === "object" && !Array.isArray(value) && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null); }
function issue(code, message, path = "") { return { code, message, path }; }
function referenceKey(reference) { return `${reference.recordType}:${reference.recordId}:${reference.scopeRelation}:${reference.technicalSourceId}:${reference.issueId || ""}`; }
function addUnique(values, value) { if (!values.includes(value)) values.push(value); }

function inspectSafe(value, path, errors, seen = new WeakSet()) {
  if (typeof value === "string") {
    if (/^data:/i.test(value.trim())) errors.push(issue("DATA_URL", "Data URLs are not permitted in an AI Draft.", path));
    if (/<\/?script\b|javascript\s*:/i.test(value)) errors.push(issue("EXECUTABLE_CONTENT", "Executable content is not permitted in an AI Draft.", path));
    if (value.length > MAX_TEXT_LENGTH) errors.push(issue("TEXT_TOO_LONG", "Text exceeds the permitted length.", path));
    return;
  }
  if (value == null || ["boolean", "number"].includes(typeof value)) {
    if (typeof value === "number" && !Number.isFinite(value)) errors.push(issue("INVALID_NUMBER", "Numbers must be finite.", path));
    return;
  }
  if (typeof value !== "object") { errors.push(issue("UNSUPPORTED_VALUE", "AI Draft contains an unsupported value.", path)); return; }
  if (seen.has(value)) { errors.push(issue("CIRCULAR_VALUE", "AI Draft contains a circular value.", path)); return; }
  seen.add(value);
  if (Array.isArray(value)) {
    if (value.length > MAX_COLLECTION_LENGTH) errors.push(issue("COLLECTION_TOO_LARGE", "A draft collection exceeds the permitted length.", path));
    value.forEach((item, index) => inspectSafe(item, `${path}[${index}]`, errors, seen));
  } else if (!object(value)) {
    errors.push(issue("NON_PLAIN_OBJECT", "AI Draft contains a non-plain object.", path));
  } else {
    for (const [key, child] of Object.entries(value)) {
      if (FORBIDDEN_KEYS.has(key.toLowerCase())) errors.push(issue("FORBIDDEN_FIELD", "AI Draft contains a forbidden binary or executable field.", `${path}.${key}`));
      inspectSafe(child, `${path}.${key}`, errors, seen);
    }
  }
  seen.delete(value);
}

function expectKeys(value, allowed, path, errors) {
  if (!object(value)) { errors.push(issue("OBJECT_REQUIRED", "An object is required.", path)); return false; }
  for (const key of Object.keys(value)) if (!allowed.has(key)) errors.push(issue("UNEXPECTED_FIELD", `Unexpected field: ${key}.`, `${path}.${key}`));
  return true;
}

function requiredText(value, label, path, errors) {
  if (!text(value)) errors.push(issue("REQUIRED_FIELD", `${label} is required.`, path));
}

function validateScope(scope, errors, path = "scope") {
  if (!expectKeys(scope, new Set(["type", "issueId"]), path, errors)) return;
  if (scope.type === "case") {
    if (scope.issueId != null) errors.push(issue("INVALID_SCOPE", "A case scope must not contain an Issue ID.", `${path}.issueId`));
    return;
  }
  if (scope.type !== "issue") { errors.push(issue("INVALID_SCOPE", "Scope type must be case or issue.", `${path}.type`)); return; }
  requiredText(scope.issueId, "Scope Issue ID", `${path}.issueId`, errors);
}

function validateReferenceShape(reference, path, errors) {
  if (!expectKeys(reference, new Set(["recordType", "recordId", "scopeRelation", "technicalSourceId", "issueId"]), path, errors)) return;
  for (const key of ["recordType", "recordId", "technicalSourceId"]) requiredText(reference[key], `Reference ${key}`, `${path}.${key}`, errors);
  if (!["direct", "linked_context"].includes(reference.scopeRelation)) errors.push(issue("INVALID_REFERENCE_RELATION", "Reference scope relation must be direct or linked_context.", `${path}.scopeRelation`));
  if (reference.issueId != null && !text(reference.issueId)) errors.push(issue("INVALID_REFERENCE_ISSUE", "Reference Issue ID must be a non-empty string or null.", `${path}.issueId`));
}

function validateReferenceAgainstBrief(reference, briefRecords, includedSources, path, errors, warnings, reviewReasons) {
  validateReferenceShape(reference, path, errors);
  const record = briefRecords.get(`${reference?.recordType}:${reference?.recordId}`);
  if (!record) {
    errors.push(issue("UNKNOWN_SOURCE_REFERENCE", "Reference does not identify a record included in the AI Brief.", path));
    return;
  }
  if (reference.scopeRelation !== record.scopeRelation) errors.push(issue("SCOPE_RELATION_MISMATCH", "Reference scope relation does not match the AI Brief.", `${path}.scopeRelation`));
  if ((reference.issueId || null) !== (record.issue?.issueId || null)) errors.push(issue("ISSUE_ASSOCIATION_MISMATCH", "Reference Issue association does not match the AI Brief.", `${path}.issueId`));
  if (!includedSources.has(reference.technicalSourceId) || !(record.sourceTechnicalReportIds || []).includes(reference.technicalSourceId)) errors.push(issue("EXCLUDED_TECHNICAL_SOURCE", "Reference cites a technical source not included for this record in the AI Brief.", `${path}.technicalSourceId`));
  if ((record.verificationStatus || "unknown") !== "verified") {
    warnings.push(issue("UNVERIFIED_SOURCE_REFERENCE", "A cited source record is not recorded as verified; human review is required.", path));
    addUnique(reviewReasons, "One or more cited records are not recorded as verified.");
  }
}

function validateReferenceList(value, label, briefRecords, includedSources, errors, warnings, reviewReasons, { required = false } = {}) {
  if (value == null) {
    if (required) errors.push(issue("SOURCE_REFERENCE_REQUIRED", `${label} requires at least one source reference.`));
    return [];
  }
  if (!Array.isArray(value)) { errors.push(issue("REFERENCES_REQUIRED", `${label} source references must be an array.`)); return []; }
  if (required && value.length === 0) errors.push(issue("SOURCE_REFERENCE_REQUIRED", `${label} requires at least one source reference.`));
  const seen = new Set();
  const normalised = [];
  value.forEach((reference, index) => {
    validateReferenceAgainstBrief(reference, briefRecords, includedSources, `${label}.sourceReferences[${index}]`, errors, warnings, reviewReasons);
    const key = object(reference) ? referenceKey(reference) : `invalid:${index}`;
    if (seen.has(key)) {
      warnings.push(issue("DUPLICATE_REFERENCE_IGNORED", "Duplicate source reference is ignored for attribution.", `${label}.sourceReferences[${index}]`));
      return;
    }
    seen.add(key);
    normalised.push(reference);
  });
  return normalised;
}

function validateClaim(claim, index, briefRecords, includedSources, errors, warnings, reviewReasons) {
  const path = `claims[${index}]`;
  if (!expectKeys(claim, new Set(["id", "classification", "text", "sourceReferences"]), path, errors)) return null;
  requiredText(claim.id, "Claim ID", `${path}.id`, errors);
  requiredText(claim.text, "Claim text", `${path}.text`, errors);
  if (!REPORT_CLAIM_CLASSIFICATIONS.includes(claim.classification)) errors.push(issue("UNSUPPORTED_CLAIM_CLASSIFICATION", "Claim classification is unsupported or missing.", `${path}.classification`));
  const requiresSources = ["recorded_fact", "observation", "allegation"].includes(claim.classification);
  const references = validateReferenceList(claim.sourceReferences, path, briefRecords, includedSources, errors, warnings, reviewReasons, { required: requiresSources });
  if (["allegation", "interpretation", "unresolved_question", "recommended_action"].includes(claim.classification)) {
    addUnique(reviewReasons, `${claim.classification.replaceAll("_", " ")} claims require human review.`);
  }
  if (claim.classification === "interpretation" && references.length === 0) warnings.push(issue("INTERPRETATION_WITHOUT_SOURCE", "An interpretation has no source reference and requires human review.", path));
  return { ...claim, sourceReferences: references };
}

function validateNarrativeItem(item, kind, index, briefRecords, includedSources, errors, warnings, reviewReasons) {
  const path = `${kind}[${index}]`;
  if (!expectKeys(item, new Set(["id", "text", "sourceReferences"]), path, errors)) return null;
  requiredText(item.id, `${kind} ID`, `${path}.id`, errors);
  requiredText(item.text, `${kind} text`, `${path}.text`, errors);
  const references = validateReferenceList(item.sourceReferences, path, briefRecords, includedSources, errors, warnings, reviewReasons);
  addUnique(reviewReasons, `${kind.replace(/([A-Z])/g, " $1").toLowerCase()} require human review.`);
  return { ...item, sourceReferences: references };
}

function validateSections(sections, claimIds, errors, reviewReasons) {
  if (!Array.isArray(sections)) { errors.push(issue("SECTIONS_REQUIRED", "Draft sections must be an array.", "sections")); return; }
  const sectionIds = new Set();
  const assignedClaims = new Set();
  sections.forEach((section, index) => {
    const path = `sections[${index}]`;
    if (!expectKeys(section, new Set(["id", "heading", "narrative", "claimIds"]), path, errors)) return;
    requiredText(section.id, "Section ID", `${path}.id`, errors);
    requiredText(section.heading, "Section heading", `${path}.heading`, errors);
    requiredText(section.narrative, "Section narrative", `${path}.narrative`, errors);
    if (sectionIds.has(section.id)) errors.push(issue("DUPLICATE_SECTION_ID", "Section IDs must be unique.", `${path}.id`));
    sectionIds.add(section.id);
    if (!Array.isArray(section.claimIds) || section.claimIds.some((id) => !text(id))) errors.push(issue("INVALID_SECTION_CLAIMS", "Section claim IDs must be an array of non-empty strings.", `${path}.claimIds`));
    else section.claimIds.forEach((claimId) => {
      if (!claimIds.has(claimId)) errors.push(issue("UNKNOWN_SECTION_CLAIM", "Section references an unknown claim.", `${path}.claimIds`));
      if (assignedClaims.has(claimId)) errors.push(issue("DUPLICATE_CLAIM_ATTRIBUTION", "A claim may appear in only one draft section.", `${path}.claimIds`));
      assignedClaims.add(claimId);
    });
  });
  for (const claimId of claimIds) if (!assignedClaims.has(claimId)) addUnique(reviewReasons, `Claim ${claimId} is not assigned to a section.`);
}

export function parseAiDraft(input, { maxBytes = AI_DRAFT_MAX_BYTES } = {}) {
  const errors = [];
  if (typeof input !== "string") return { valid: false, draft: null, errors: [issue("INPUT_TYPE", "AI Draft input must be a JSON string.")] };
  if (new TextEncoder().encode(input).byteLength > maxBytes) return { valid: false, draft: null, errors: [issue("PAYLOAD_TOO_LARGE", "AI Draft JSON exceeds the permitted size.")] };
  let draft;
  try { draft = JSON.parse(input); } catch { return { valid: false, draft: null, errors: [issue("MALFORMED_JSON", "AI Draft input is not valid JSON.")] }; }
  inspectSafe(draft, "draft", errors);
  return { valid: errors.length === 0, draft: errors.length ? null : draft, errors };
}

export function validateAiDraft(draft, brief) {
  const errors = [];
  const warnings = [];
  const reviewReasons = ["AI-generated narrative must receive human review before it is relied on or shared."];
  const briefValidation = validateAiBrief(brief);
  if (!briefValidation.valid) return { valid: false, errors: briefValidation.errors.map((message) => issue("INVALID_AI_BRIEF", message)), warnings, humanReviewRequired: true, reviewReasons };
  inspectSafe(draft, "draft", errors);
  if (!expectKeys(draft, new Set(["schema", "reportFamily", "case", "scope", "sourceAiBrief", "sections", "claims", "unresolvedQuestions", "evidenceGaps", "recommendations"]), "draft", errors)) return { valid: false, errors, warnings, humanReviewRequired: true, reviewReasons };
  if (!expectKeys(draft.schema, new Set(["id", "version"]), "draft.schema", errors) || draft.schema?.id !== AI_DRAFT_SCHEMA_ID || draft.schema?.version !== AI_DRAFT_SCHEMA_VERSION) errors.push(issue("UNSUPPORTED_SCHEMA", "AI Draft schema name or version is unsupported.", "draft.schema"));
  if (!PROFESSIONAL_FAMILIES.has(draft.reportFamily)) errors.push(issue("UNSUPPORTED_REPORT_FAMILY", "AI Draft report family is unsupported.", "draft.reportFamily"));
  if (!expectKeys(draft.case, new Set(["id"]), "draft.case", errors)) errors.push(issue("CASE_REQUIRED", "AI Draft case is required.", "draft.case"));
  else if (draft.case.id !== brief.case.id) errors.push(issue("CASE_MISMATCH", "AI Draft case does not match the AI Brief.", "draft.case.id"));
  validateScope(draft.scope, errors);
  const briefScope = brief.scope?.type === "issue" ? { type: "issue", issueId: brief.scope.issueId } : { type: "case" };
  if (draft.scope?.type !== briefScope.type || (briefScope.type === "issue" && draft.scope?.issueId !== briefScope.issueId)) errors.push(issue("SCOPE_MISMATCH", "AI Draft scope does not match the AI Brief.", "draft.scope"));
  if (draft.reportFamily !== brief.requestedReportFamily) errors.push(issue("REPORT_FAMILY_MISMATCH", "AI Draft report family does not match the AI Brief.", "draft.reportFamily"));
  if (!expectKeys(draft.sourceAiBrief, new Set(["sourceFingerprint", "caseRevision"]), "draft.sourceAiBrief", errors)) errors.push(issue("AI_BRIEF_BINDING_REQUIRED", "AI Brief binding is required.", "draft.sourceAiBrief"));
  else {
    if (draft.sourceAiBrief.sourceFingerprint !== brief.source.sourceFingerprint) errors.push(issue("FINGERPRINT_MISMATCH", "AI Draft source fingerprint does not match the AI Brief.", "draft.sourceAiBrief.sourceFingerprint"));
    if (draft.sourceAiBrief.caseRevision !== brief.source.caseRevision) errors.push(issue("REVISION_MISMATCH", "AI Draft source revision does not match the AI Brief.", "draft.sourceAiBrief.caseRevision"));
  }
  const briefRecords = new Map((brief.recordReferences || []).map((record) => [`${record.recordType}:${record.recordId}`, record]));
  const includedSources = new Set((brief.technicalSources || []).filter((source) => source.included).map((source) => source.id));
  const claims = Array.isArray(draft.claims) ? draft.claims : [];
  if (!Array.isArray(draft.claims)) errors.push(issue("CLAIMS_REQUIRED", "Draft claims must be an array.", "claims"));
  const claimIds = new Set();
  const normalisedClaims = claims.map((claim, index) => {
    const normalised = validateClaim(claim, index, briefRecords, includedSources, errors, warnings, reviewReasons);
    if (text(claim?.id)) {
      if (claimIds.has(claim.id)) errors.push(issue("DUPLICATE_CLAIM_ID", "Claim IDs must be unique.", `claims[${index}].id`));
      claimIds.add(claim.id);
    }
    return normalised || claim;
  });
  validateSections(draft.sections, claimIds, errors, reviewReasons);
  const normalisedCollections = {};
  for (const kind of ["unresolvedQuestions", "evidenceGaps", "recommendations"]) {
    if (!Array.isArray(draft[kind])) { errors.push(issue("NARRATIVE_COLLECTION_REQUIRED", `${kind} must be an array.`, kind)); normalisedCollections[kind] = []; continue; }
    const ids = new Set();
    normalisedCollections[kind] = draft[kind].map((item, index) => {
      const normalised = validateNarrativeItem(item, kind, index, briefRecords, includedSources, errors, warnings, reviewReasons);
      if (text(item?.id)) {
        if (ids.has(item.id)) errors.push(issue("DUPLICATE_NARRATIVE_ID", `${kind} IDs must be unique.`, `${kind}[${index}].id`));
        ids.add(item.id);
      }
      return normalised || item;
    });
  }
  return {
    valid: errors.length === 0,
    errors,
    warnings,
    humanReviewRequired: true,
    reviewReasons,
    normalisedDraft: { ...draft, claims: normalisedClaims, ...normalisedCollections },
  };
}

export function parseAndValidateAiDraft(input, brief, options) {
  const parsed = parseAiDraft(input, options);
  if (!parsed.valid) return { valid: false, errors: parsed.errors, warnings: [], humanReviewRequired: true, reviewReasons: ["AI-generated narrative must receive human review before it is relied on or shared."], normalisedDraft: null };
  return validateAiDraft(parsed.draft, brief);
}
