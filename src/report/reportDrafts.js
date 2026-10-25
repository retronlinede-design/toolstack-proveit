import { generateId } from "../domain/id.js";
import {
  REPORT_LIFECYCLE_SCHEMA_VERSION,
  calculateReportRevisionChecksum,
  getReportSourceFreshness,
  verifyReportRevisionChecksum,
} from "./reportLifecycle.js";
import {
  REPORT_LIBRARY_SCHEMA_VERSION,
  classifyReportLibrary,
  validateReportLibraryIntegrity,
} from "./reportLibrary.js";
import { validateReportDocument } from "./reportDocument.js";

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function requireText(value, label) {
  const result = text(value);
  if (!result) throw new TypeError(`${label} is required.`);
  return result;
}

function executiveScope(document) {
  const scope = document?.source?.scope || {};
  if (scope.type === "case") return { type: "case" };
  if (scope.type === "sequenceGroup" && text(scope.issueId)) return { type: "issue", issueId: text(scope.issueId) };
  throw new TypeError("An Executive Report draft requires a valid canonical case or Issue scope.");
}

function clientUpdateScope(document, caseId) {
  if (document?.report?.id !== "client") throw new TypeError("A Client Update revision requires a Client Update report document.");
  if (document?.source?.caseId !== caseId) throw new TypeError("Client Update report document case identity does not match the target case.");
  if (document?.source?.scope?.type !== "case") throw new TypeError("Client Update revisions currently require whole-case scope.");
  return { type: "case" };
}

function supportedClientLanguage(value) {
  const language = text(value).toLocaleLowerCase();
  if (!new Set(["en", "de"]).has(language)) throw new TypeError("Client Update language must be en or de.");
  return language;
}

function requiredClientDocument(document, caseId, sourceFingerprint) {
  const validation = validateReportDocument(document);
  if (!validation.valid) throw new TypeError(`Client Update report document is invalid: ${validation.errors.join(" ")}`);
  clientUpdateScope(document, caseId);
  if (document.source?.sourceRevision?.fingerprint !== sourceFingerprint) {
    throw new TypeError("Client Update report document source fingerprint does not match the supplied source fingerprint.");
  }
  return cloneJson(document);
}

function draftCitationRelationship(sectionId, sourceReference) {
  if (sectionId === "contradictions-and-questions" || /unresolved|unavailable/i.test(sourceReference?.title || "")) return "unresolved";
  return "direct";
}

function collectSourceReferences(value, callback, seen = new WeakSet(), sectionId = "") {
  if (!value || typeof value !== "object") return;
  if (seen.has(value)) return;
  seen.add(value);
  if (value.sourceReference && typeof value.sourceReference === "object") callback(value.sourceReference, sectionId);
  if (Array.isArray(value)) {
    value.forEach((item) => collectSourceReferences(item, callback, seen, sectionId));
    return;
  }
  for (const child of Object.values(value)) collectSourceReferences(child, callback, seen, sectionId);
}

export function extractReportDocumentProvenance(reportDocument) {
  const citations = [];
  const seen = new Set();
  for (const section of reportDocument?.sections || []) {
    collectSourceReferences(section, (sourceReference, sectionId) => {
      const recordType = text(sourceReference.recordType);
      const recordId = text(sourceReference.recordId);
      if (!recordType || !recordId) return;
      const key = `${recordType}:${recordId}:${sectionId}`;
      if (seen.has(key)) return;
      seen.add(key);
      const citation = {
        id: `citation-${citations.length + 1}`,
        recordType,
        recordId,
        relationship: draftCitationRelationship(sectionId, sourceReference),
      };
      const issueId = text(reportDocument?.source?.scope?.issueId);
      const recordReference = text(sourceReference.label);
      const recordTitle = text(sourceReference.title);
      if (issueId) citation.issueId = issueId;
      if (recordReference) citation.recordReference = recordReference;
      if (recordTitle) citation.recordTitle = recordTitle;
      citations.push(citation);
    }, new WeakSet(), section.id || "");
  }
  return { citations, claims: [] };
}

export const extractExecutiveDraftProvenance = extractReportDocumentProvenance;

function emptyLibrary() {
  return { schemaVersion: REPORT_LIBRARY_SCHEMA_VERSION, reports: {}, revisions: {} };
}

function requireSupportedLibrary(library, caseId) {
  const result = classifyReportLibrary(library, { caseId });
  if (result.kind === "absent") return emptyLibrary();
  if (result.kind !== "supported") throw new TypeError(`Saved Drafts are unavailable: ${result.errors.join(" ")}`);
  return cloneJson(library);
}

/** Builds a complete candidate library without persisting or regenerating content. */
export async function buildExecutiveDraftCandidate({
  caseItem,
  reportDocument,
  markdown,
  json,
  reportId = "",
  now = new Date().toISOString(),
  createId = generateId,
} = {}) {
  const caseId = requireText(caseItem?.id, "Case ID");
  if (reportDocument?.report?.id !== "executive") throw new TypeError("Only Executive Reports can be saved by this pilot.");
  const sourceFingerprint = requireText(reportDocument?.source?.sourceRevision?.fingerprint, "Source report fingerprint");
  const sourceRevision = Number(caseItem?.revision);
  if (!Number.isSafeInteger(sourceRevision) || sourceRevision < 1) throw new TypeError("Case revision is unavailable for this draft.");
  const outputMarkdown = requireText(markdown, "Executive Report Markdown");
  const outputJson = requireText(json, "Executive Report JSON");
  const scope = executiveScope(reportDocument);
  const library = requireSupportedLibrary(caseItem?.reportLibrary, caseId);
  const existingReportId = text(reportId);
  const existingManifest = existingReportId ? library.reports[existingReportId] : null;
  if (existingReportId && (!existingManifest || existingManifest.reportType !== "executive" || existingManifest.caseId !== caseId || existingManifest.status !== "draft")) {
    throw new TypeError("The selected saved Draft is unavailable for a new revision.");
  }
  const parentRevision = existingManifest ? library.revisions[existingManifest.currentRevisionId] : null;
  if (existingManifest && !parentRevision) throw new TypeError("The selected saved Draft has no current revision.");
  if (existingManifest && JSON.stringify(existingManifest.scope) !== JSON.stringify(scope)) {
    throw new TypeError("A new Draft revision must keep the saved report's canonical scope.");
  }

  const nextReportId = existingManifest ? existingManifest.id : createId();
  const revisionId = createId();
  const versionNumber = parentRevision ? parentRevision.versionNumber + 1 : 1;
  const revision = {
    schemaVersion: REPORT_LIFECYCLE_SCHEMA_VERSION,
    id: revisionId,
    reportId: nextReportId,
    versionNumber,
    parentRevisionId: parentRevision?.id || null,
    createdAt: now,
    source: { caseRevision: sourceRevision, fingerprint: sourceFingerprint },
    content: { reportDocument: cloneJson(reportDocument), markdown: outputMarkdown, json: outputJson },
    generationMode: "deterministic",
    provenance: extractExecutiveDraftProvenance(reportDocument),
    contentChecksum: "",
    lifecycle: { status: "draft", updatedAt: now, review: {} },
  };
  revision.contentChecksum = await calculateReportRevisionChecksum(revision);
  const manifest = existingManifest
    ? { ...existingManifest, currentRevisionId: revisionId, revisionIds: [...existingManifest.revisionIds, revisionId], status: "draft" }
    : {
      schemaVersion: REPORT_LIFECYCLE_SCHEMA_VERSION,
      id: nextReportId,
      caseId,
      reportType: "executive",
      title: requireText(reportDocument?.report?.title, "Executive Report title"),
      createdAt: now,
      scope,
      status: "draft",
      currentRevisionId: revisionId,
      approvedRevisionId: null,
      revisionIds: [revisionId],
    };
  const candidate = {
    schemaVersion: REPORT_LIBRARY_SCHEMA_VERSION,
    reports: { ...library.reports, [nextReportId]: manifest },
    revisions: { ...library.revisions, [revisionId]: revision },
  };
  const validation = await validateReportLibraryIntegrity(candidate, { caseId });
  if (!validation.valid) throw new TypeError(`Executive Report Draft is invalid: ${validation.errors.join(" ")}`);
  return { reportLibrary: candidate, manifest, revision };
}

/** Builds, but does not persist, an immutable Client Update report revision. */
export async function buildClientUpdateDraftCandidate({
  caseItem,
  reportDocument,
  language,
  acceptedNarrative,
  markdown,
  json,
  sourceCaseRevision = caseItem?.revision,
  sourceFingerprint = reportDocument?.source?.sourceRevision?.fingerprint,
  promptRevision,
  provenance,
  reportId = "",
  now = new Date().toISOString(),
  createId = generateId,
} = {}) {
  const caseId = requireText(caseItem?.id, "Case ID");
  const clientLanguage = supportedClientLanguage(language);
  const narrative = requireText(acceptedNarrative, "Accepted Client Update narrative");
  const outputMarkdown = requireText(markdown, "Client Update Markdown");
  const outputJson = requireText(json, "Client Update JSON");
  const fingerprint = requireText(sourceFingerprint, "Source report fingerprint");
  const formatRevision = requireText(promptRevision, "Client Update prompt or format revision");
  if (!Number.isSafeInteger(sourceCaseRevision) || sourceCaseRevision < 1) throw new TypeError("Source case revision is unavailable for this Client Update.");
  if (!provenance || typeof provenance !== "object" || Array.isArray(provenance)) throw new TypeError("Client Update provenance is required.");
  const documentSnapshot = requiredClientDocument(reportDocument, caseId, fingerprint);
  const library = requireSupportedLibrary(caseItem?.reportLibrary, caseId);
  const libraryIntegrity = await validateReportLibraryIntegrity(library, { caseId });
  if (!libraryIntegrity.valid) throw new TypeError(`Existing report library is invalid: ${libraryIntegrity.errors.join(" ")}`);
  const existingReportId = text(reportId);
  const existingManifest = existingReportId ? library.reports[existingReportId] : null;
  if (existingReportId && (!existingManifest || existingManifest.reportType !== "client" || existingManifest.caseId !== caseId || existingManifest.status !== "draft")) {
    throw new TypeError("The selected Client Update Draft is unavailable for a new revision.");
  }
  if (existingManifest && JSON.stringify(existingManifest.scope) !== JSON.stringify({ type: "case" })) {
    throw new TypeError("A new Client Update revision must keep the saved whole-case scope.");
  }
  const parentRevision = existingManifest ? library.revisions[existingManifest.currentRevisionId] : null;
  if (existingManifest && !parentRevision) throw new TypeError("The selected Client Update Draft has no current revision.");

  const nextReportId = existingManifest ? existingManifest.id : createId();
  const revisionId = createId();
  if (library.revisions[revisionId]) throw new TypeError("Client Update revision ID already exists.");
  const revision = {
    schemaVersion: REPORT_LIFECYCLE_SCHEMA_VERSION,
    id: revisionId,
    reportId: nextReportId,
    versionNumber: parentRevision ? parentRevision.versionNumber + 1 : 1,
    parentRevisionId: parentRevision?.id || null,
    createdAt: now,
    source: { caseRevision: sourceCaseRevision, fingerprint },
    content: {
      reportDocument: documentSnapshot,
      markdown: outputMarkdown,
      json: outputJson,
      clientUpdate: { language: clientLanguage, acceptedNarrative: narrative, promptRevision: formatRevision },
    },
    generationMode: "ai_assisted",
    provenance: cloneJson(provenance),
    contentChecksum: "",
    lifecycle: { status: "draft", updatedAt: now, review: {} },
  };
  revision.contentChecksum = await calculateReportRevisionChecksum(revision);
  const manifest = existingManifest
    ? { ...existingManifest, currentRevisionId: revisionId, revisionIds: [...existingManifest.revisionIds, revisionId], status: "draft" }
    : {
      schemaVersion: REPORT_LIFECYCLE_SCHEMA_VERSION,
      id: nextReportId,
      caseId,
      reportType: "client",
      title: requireText(documentSnapshot?.report?.title, "Client Update title"),
      createdAt: now,
      scope: { type: "case" },
      status: "draft",
      currentRevisionId: revisionId,
      approvedRevisionId: null,
      revisionIds: [revisionId],
    };
  const candidate = {
    schemaVersion: REPORT_LIBRARY_SCHEMA_VERSION,
    reports: { ...library.reports, [nextReportId]: manifest },
    revisions: { ...library.revisions, [revisionId]: revision },
  };
  const validation = await validateReportLibraryIntegrity(candidate, { caseId });
  if (!validation.valid) throw new TypeError(`Client Update Draft is invalid: ${validation.errors.join(" ")}`);
  return { reportLibrary: candidate, manifest, revision };
}

export function getExecutiveSavedDrafts(caseItem) {
  const result = classifyReportLibrary(caseItem?.reportLibrary, { caseId: caseItem?.id || "" });
  if (result.kind !== "supported") return [];
  return Object.values(caseItem.reportLibrary.reports)
    .filter((manifest) => manifest.reportType === "executive" && manifest.status === "draft")
    .flatMap((manifest) => manifest.revisionIds.map((revisionId) => ({ manifest, revision: caseItem.reportLibrary.revisions[revisionId] })))
    .filter((item) => item.revision?.content?.reportDocument?.report?.id === "executive" && text(item.revision.content.markdown) && text(item.revision.content.json))
    .sort((left, right) => String(right.revision.createdAt).localeCompare(String(left.revision.createdAt)));
}

export function getExecutiveSavedDraft(caseItem, revisionId) {
  return getExecutiveSavedDrafts(caseItem).find((item) => item.revision.id === revisionId) || null;
}

export function getExecutiveDraftFreshness(revision, currentFingerprint, scopeAvailable = true) {
  if (!scopeAvailable) return "unknown";
  return getReportSourceFreshness(revision, currentFingerprint);
}

function isClientUpdateRevision(revision) {
  return revision?.content?.reportDocument?.report?.id === "client"
    && text(revision?.content?.markdown)
    && text(revision?.content?.json)
    && ["en", "de"].includes(revision?.content?.clientUpdate?.language)
    && text(revision?.content?.clientUpdate?.acceptedNarrative)
    && text(revision?.content?.clientUpdate?.promptRevision);
}

export function getClientUpdateSavedDrafts(caseItem) {
  const result = classifyReportLibrary(caseItem?.reportLibrary, { caseId: caseItem?.id || "" });
  if (result.kind !== "supported") return [];
  return Object.values(caseItem.reportLibrary.reports)
    .filter((manifest) => manifest.reportType === "client")
    .flatMap((manifest) => manifest.revisionIds.map((revisionId) => ({ manifest, revision: caseItem.reportLibrary.revisions[revisionId] })))
    .filter((item) => isClientUpdateRevision(item.revision))
    .sort((left, right) => String(right.revision.createdAt).localeCompare(String(left.revision.createdAt)));
}

export function getClientUpdateSavedDraft(caseItem, revisionId) {
  return getClientUpdateSavedDrafts(caseItem).find((item) => item.revision.id === revisionId) || null;
}

export async function verifyClientUpdateSavedDraft(caseItem, revisionId) {
  const draft = getClientUpdateSavedDraft(caseItem, revisionId);
  if (!draft) return { valid: false, errors: ["The selected Client Update revision is unavailable or malformed."] };
  const documentValidation = validateReportDocument(draft.revision.content.reportDocument);
  if (!documentValidation.valid) return { valid: false, errors: documentValidation.errors };
  if (draft.revision.content.reportDocument.source?.caseId !== caseItem?.id) {
    return { valid: false, errors: ["The selected Client Update revision belongs to a different case."] };
  }
  const checksum = await verifyReportRevisionChecksum(draft.revision);
  return checksum.valid ? { valid: true, errors: [], draft } : checksum;
}

export function getClientUpdateDraftFreshness(revision, currentFingerprint) {
  return getReportSourceFreshness(revision, currentFingerprint);
}
