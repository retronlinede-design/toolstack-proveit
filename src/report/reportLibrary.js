import {
  REPORT_LIFECYCLE_SCHEMA_VERSION,
  REPORT_LIFECYCLE_STATES,
  verifyReportRevisionChecksum,
  validateReportManifest,
  validateReportRevision,
} from "./reportLifecycle.js";

export const REPORT_LIBRARY_SCHEMA_VERSION = 1;

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function isObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isTimestamp(value) {
  return typeof value === "string" && value.trim() !== "" && !Number.isNaN(Date.parse(value));
}

function add(errors, prefix, result) {
  errors.push(...result.errors.map((error) => `${prefix}: ${error}`));
}

function validateLifecycle(lifecycle) {
  const errors = [];
  if (!isObject(lifecycle)) return { valid: false, errors: ["Lifecycle metadata must be an object."] };
  if (!REPORT_LIFECYCLE_STATES.includes(lifecycle.status)) errors.push("Lifecycle status is invalid.");
  if (!isTimestamp(lifecycle.updatedAt)) errors.push("Lifecycle update timestamp is invalid.");
  if (lifecycle.review != null && !isObject(lifecycle.review)) errors.push("Lifecycle review metadata must be an object when supplied.");
  if (lifecycle.status === "approved") {
    if (!text(lifecycle.review?.reviewedBy)) errors.push("Approved lifecycle metadata requires a local reviewer name.");
    if (!isTimestamp(lifecycle.review?.reviewedAt)) errors.push("Approved lifecycle metadata requires a review timestamp.");
  }
  return { valid: errors.length === 0, errors };
}

function validateRevisionGraph(revisions, reports, errors, allowPartial) {
  for (const [revisionId, revision] of Object.entries(revisions)) {
    if (!isObject(revision) || revision.id !== revisionId) continue;
    if (!reports[revision.reportId]) errors.push(`Revision ${revisionId} has no parent report.`);
    if (revision.parentRevisionId && !revisions[revision.parentRevisionId] && !allowPartial) errors.push(`Revision ${revisionId} has a missing parent revision.`);
    if (revision.parentRevisionId && revisions[revision.parentRevisionId] && revisions[revision.parentRevisionId]?.reportId !== revision.reportId) errors.push(`Revision ${revisionId} parent belongs to a different report.`);
    const seen = new Set([revisionId]);
    let parentId = revision.parentRevisionId || null;
    while (parentId) {
      if (seen.has(parentId)) { errors.push(`Revision ${revisionId} has a cyclic parent chain.`); break; }
      seen.add(parentId);
      parentId = revisions[parentId]?.parentRevisionId || null;
    }
  }
}

export function classifyReportLibrary(library, { caseId = "", allowPartial = false } = {}) {
  if (library == null) return { kind: "absent", valid: true, errors: [] };
  if (!isObject(library)) return { kind: "malformed", valid: false, errors: ["Report library must be an object."] };
  if (!Number.isSafeInteger(library.schemaVersion)) return { kind: "malformed", valid: false, errors: ["Report library schema version must be an integer."] };
  if (library.schemaVersion > REPORT_LIBRARY_SCHEMA_VERSION) return { kind: "unsupported", valid: false, errors: [`Report library schema version ${library.schemaVersion} is not supported.`] };
  if (library.schemaVersion !== REPORT_LIBRARY_SCHEMA_VERSION) return { kind: "malformed", valid: false, errors: ["Unsupported or missing report library schema version."] };

  const errors = [];
  if (!isObject(library.reports)) errors.push("Report library reports must be an object map.");
  if (!isObject(library.revisions)) errors.push("Report library revisions must be an object map.");
  const reports = isObject(library.reports) ? library.reports : {};
  const revisions = isObject(library.revisions) ? library.revisions : {};

  for (const [reportId, manifest] of Object.entries(reports)) {
    if (!isObject(manifest) || manifest.id !== reportId) errors.push(`Report manifest map key ${reportId} does not match its embedded ID.`);
    add(errors, `Report ${reportId}`, validateReportManifest(manifest));
    if (caseId && manifest?.caseId !== caseId) errors.push(`Report ${reportId} belongs to a different case.`);
    const listed = Array.isArray(manifest?.revisionIds) ? manifest.revisionIds : [];
    for (const revisionId of listed) {
      if (!revisions[revisionId] && !allowPartial) errors.push(`Report ${reportId} references a missing revision ${revisionId}.`);
      else if (revisions[revisionId] && revisions[revisionId]?.reportId !== reportId) errors.push(`Report ${reportId} references a revision owned by another report.`);
    }
    if (manifest?.currentRevisionId && revisions[manifest.currentRevisionId] && revisions[manifest.currentRevisionId]?.lifecycle?.status !== manifest.status) {
      errors.push(`Report ${reportId} lifecycle status does not match its current revision.`);
    }
    if (manifest?.approvedRevisionId && revisions[manifest.approvedRevisionId] && revisions[manifest.approvedRevisionId]?.lifecycle?.status !== "approved") {
      errors.push(`Report ${reportId} approved revision is not approved.`);
    }
  }

  for (const [revisionId, revision] of Object.entries(revisions)) {
    if (!isObject(revision) || revision.id !== revisionId) errors.push(`Revision map key ${revisionId} does not match its embedded ID.`);
    add(errors, `Revision ${revisionId}`, validateReportRevision(revision));
    add(errors, `Revision ${revisionId}`, validateLifecycle(revision?.lifecycle));
  }
  validateRevisionGraph(revisions, reports, errors, allowPartial);
  for (const [revisionId, revision] of Object.entries(revisions)) {
    if (!reports[revision?.reportId]?.revisionIds?.includes(revisionId) && !allowPartial) errors.push(`Revision ${revisionId} is not listed by its parent report.`);
  }
  return { kind: errors.length ? "malformed" : "supported", valid: errors.length === 0, errors };
}

export async function validateReportLibraryIntegrity(library, options = {}) {
  const structural = classifyReportLibrary(library, options);
  if (structural.kind !== "supported") return structural;
  const errors = [];
  for (const [revisionId, revision] of Object.entries(library.revisions)) {
    const checksum = await verifyReportRevisionChecksum(revision);
    add(errors, `Revision ${revisionId}`, checksum);
  }
  return { kind: errors.length ? "malformed" : "supported", valid: errors.length === 0, errors };
}

function stableValue(value) {
  if (value == null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(stableValue);
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
}

export function reportLibraryValuesEqual(left, right) {
  return JSON.stringify(stableValue(left)) === JSON.stringify(stableValue(right));
}

export class ReportLibraryConflictError extends Error {
  constructor(message) {
    super(message);
    this.name = "ReportLibraryConflictError";
    this.code = "REPORT_LIBRARY_CONFLICT";
  }
}

export function mergeReportLibraries(localLibrary, incomingLibrary, { caseId = "" } = {}) {
  const local = classifyReportLibrary(localLibrary, { caseId });
  const incoming = classifyReportLibrary(incomingLibrary, { caseId, allowPartial: true });
  if (incoming.kind === "absent") return local.kind === "absent" ? undefined : localLibrary;
  if (incoming.kind !== "supported") throw new ReportLibraryConflictError(`Incoming report library cannot be merged: ${incoming.errors.join(" ")}`);
  if (local.kind === "absent") return incomingLibrary;
  if (local.kind !== "supported") throw new ReportLibraryConflictError("Existing report library is unsupported or malformed and cannot be merged.");

  const reports = { ...localLibrary.reports };
  const revisions = { ...localLibrary.revisions };
  for (const [revisionId, incomingRevision] of Object.entries(incomingLibrary.revisions)) {
    const existing = revisions[revisionId];
    if (!existing) { revisions[revisionId] = incomingRevision; continue; }
    if (existing.contentChecksum !== incomingRevision.contentChecksum) throw new ReportLibraryConflictError(`Immutable revision conflict for ${revisionId}.`);
    if (!reportLibraryValuesEqual(existing.lifecycle, incomingRevision.lifecycle)) throw new ReportLibraryConflictError(`Lifecycle metadata conflict for revision ${revisionId}.`);
  }
  for (const [reportId, incomingManifest] of Object.entries(incomingLibrary.reports)) {
    const existing = reports[reportId];
    if (!existing) { reports[reportId] = incomingManifest; continue; }
    const existingComparable = { ...existing }; delete existingComparable.revisionIds;
    const incomingComparable = { ...incomingManifest }; delete incomingComparable.revisionIds;
    if (!reportLibraryValuesEqual(existingComparable, incomingComparable)) throw new ReportLibraryConflictError(`Manifest pointer or lifecycle conflict for report ${reportId}.`);
    reports[reportId] = {
      ...existing,
      revisionIds: [...new Set([...existing.revisionIds, ...incomingManifest.revisionIds])],
    };
  }
  const combined = { schemaVersion: REPORT_LIBRARY_SCHEMA_VERSION, reports, revisions };
  const checked = classifyReportLibrary(combined, { caseId });
  if (!checked.valid) throw new ReportLibraryConflictError(`Combined report history is incomplete: ${checked.errors.join(" ")}`);
  return combined;
}

export function preserveReportLibraryDuringNormalization(caseItem) {
  if (!Object.hasOwn(caseItem || {}, "reportLibrary")) return {};
  return { reportLibrary: caseItem.reportLibrary };
}
