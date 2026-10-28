import { generateId } from "../domain/id.js";
import {
  REPORT_LIFECYCLE_SCHEMA_VERSION,
  canonicalSerialiseReportRevisionContent,
  calculateReportRevisionChecksum,
  getReportSourceFreshness,
  transitionReportLifecycle,
  verifyReportRevisionChecksum,
} from "./reportLifecycle.js";
import {
  REPORT_LIBRARY_SCHEMA_VERSION,
  classifyReportLibrary,
  validateReportLibraryIntegrity,
} from "./reportLibrary.js";
import { validateReportDocument } from "./reportDocument.js";
import { validateAiBrief } from "./aiBrief.js";
import { validateAiDraft } from "./aiDraft.js";
import { isManagementAiDraftPreview } from "./managementAiDraftPreview.js";

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

function managementAiDraftScope(previewDocument, caseId) {
  if (!isManagementAiDraftPreview(previewDocument)) throw new TypeError("A valid Management AI Draft preview is required.");
  if (previewDocument.source?.caseId !== caseId) throw new TypeError("Management AI Draft preview case identity does not match the target case.");
  const scope = previewDocument.source?.scope || {};
  if (scope.type === "case") return { type: "case" };
  if (scope.type === "sequenceGroup" && text(scope.issueId)) return { type: "issue", issueId: text(scope.issueId) };
  throw new TypeError("Management AI Draft preview scope is unavailable or invalid.");
}

function managementAiDraftProvenance(draft) {
  const citations = [];
  const citationIds = new Map();
  const claims = [];
  for (const claim of draft.claims || []) {
    const ids = [];
    for (const reference of claim.sourceReferences || []) {
      const key = `${reference.recordType}:${reference.recordId}:${reference.scopeRelation}:${reference.technicalSourceId}:${reference.issueId || ""}`;
      let citationId = citationIds.get(key);
      if (!citationId) {
        citationId = `citation-${citations.length + 1}`;
        citationIds.set(key, citationId);
        citations.push({ id: citationId, recordType: reference.recordType, recordId: reference.recordId, relationship: reference.scopeRelation, ...(reference.issueId ? { issueId: reference.issueId } : {}), recordReference: reference.recordId });
      }
      ids.push(citationId);
    }
    claims.push({ id: claim.id, classification: claim.classification, citationIds: [...new Set(ids)] });
  }
  return { citations, claims };
}

function sameManagementAiDraftSnapshot(revision, draft, brief) {
  const saved = revision?.content?.managementAiDraft;
  if (!saved?.acceptedDraft || !saved?.aiBrief) return false;
  return canonicalSerialiseReportRevisionContent({ draft: saved.acceptedDraft, brief: saved.aiBrief }) === canonicalSerialiseReportRevisionContent({ draft, brief });
}

/** Builds, but does not persist, an immutable Management Report revision from a validated external AI Draft. */
export async function buildManagementAiDraftCandidate({
  caseItem,
  aiDraft,
  aiBrief,
  validation,
  previewDocument,
  currentSourceFingerprint,
  currentBriefCaseRevision,
  currentCaseRevision = caseItem?.revision,
  reportId = "",
  now = new Date().toISOString(),
  createId = generateId,
} = {}) {
  const caseId = requireText(caseItem?.id, "Case ID");
  if (!validation?.valid) throw new TypeError("Management AI Draft must be successfully validated before acceptance.");
  const briefCheck = validateAiBrief(aiBrief);
  if (!briefCheck.valid) throw new TypeError(`Management AI Brief is invalid: ${briefCheck.errors.join(" ")}`);
  if (aiBrief.requestedReportFamily !== "management") throw new TypeError("Only a Management AI Brief can be accepted as a Management Draft.");
  const draftCheck = validateAiDraft(aiDraft, aiBrief);
  if (!draftCheck.valid || draftCheck.normalisedDraft?.reportFamily !== "management") throw new TypeError(`Management AI Draft is invalid: ${draftCheck.errors.map((error) => error.message).join(" ")}`);
  const fingerprint = requireText(currentSourceFingerprint, "Current source fingerprint");
  if (fingerprint !== aiBrief.source?.sourceFingerprint) throw new TypeError("Management AI Draft source fingerprint is no longer current.");
  const briefCaseRevision = requireText(currentBriefCaseRevision, "Current source revision");
  if (briefCaseRevision !== aiBrief.source?.caseRevision) throw new TypeError("Management AI Draft source revision is no longer current.");
  if (!Number.isSafeInteger(currentCaseRevision) || currentCaseRevision < 1) throw new TypeError("Current case revision is unavailable for this Management Draft.");
  const scope = managementAiDraftScope(previewDocument, caseId);
  if (previewDocument.aiDraftPreview?.sourceFingerprint !== fingerprint || previewDocument.aiDraftPreview?.sourceRevision !== aiBrief.source?.caseRevision) throw new TypeError("Management AI Draft preview does not match the original AI Brief binding.");
  const library = requireSupportedLibrary(caseItem?.reportLibrary, caseId);
  const integrity = await validateReportLibraryIntegrity(library, { caseId });
  if (!integrity.valid) throw new TypeError(`Existing report library is invalid: ${integrity.errors.join(" ")}`);
  const existingReportId = text(reportId);
  const existingManifest = existingReportId ? library.reports[existingReportId] : null;
  if (existingReportId && (!existingManifest || existingManifest.reportType !== "management" || existingManifest.caseId !== caseId || existingManifest.status !== "draft")) throw new TypeError("The selected Management Draft is unavailable for a new revision.");
  if (existingManifest && JSON.stringify(existingManifest.scope) !== JSON.stringify(scope)) throw new TypeError("A new Management Draft revision must keep the saved canonical scope.");
  const parentRevision = existingManifest ? library.revisions[existingManifest.currentRevisionId] : null;
  if (existingManifest && !parentRevision) throw new TypeError("The selected Management Draft has no current revision.");
  if (Object.values(library.revisions).some((revision) => revision.reportId && library.reports[revision.reportId]?.reportType === "management" && sameManagementAiDraftSnapshot(revision, aiDraft, aiBrief))) throw new TypeError("This exact Management AI Draft has already been accepted as an immutable revision.");
  const nextReportId = existingManifest ? existingManifest.id : createId();
  const revisionId = createId();
  if (library.revisions[revisionId]) throw new TypeError("Management AI Draft revision ID already exists.");
  const acceptedDraft = cloneJson(aiDraft);
  const acceptedBrief = cloneJson(aiBrief);
  const revision = {
    schemaVersion: REPORT_LIFECYCLE_SCHEMA_VERSION, id: revisionId, reportId: nextReportId, versionNumber: parentRevision ? parentRevision.versionNumber + 1 : 1, parentRevisionId: parentRevision?.id || null, createdAt: now,
    source: { caseRevision: currentCaseRevision, fingerprint },
    content: { reportDocument: cloneJson(previewDocument), managementAiDraft: { acceptedDraft, aiBrief: acceptedBrief, sourceAiBrief: { caseRevision: aiBrief.source.caseRevision, sourceFingerprint: fingerprint }, validation: { warnings: cloneJson(draftCheck.warnings), reviewReasons: [...new Set(draftCheck.reviewReasons)] }, generation: { mode: "ai_assisted", origin: "externally_drafted" } } },
    generationMode: "ai_assisted", provenance: managementAiDraftProvenance(draftCheck.normalisedDraft), contentChecksum: "", lifecycle: { status: "draft", updatedAt: now, review: {} },
  };
  revision.contentChecksum = await calculateReportRevisionChecksum(revision);
  const manifest = existingManifest
    ? { ...existingManifest, currentRevisionId: revisionId, revisionIds: [...existingManifest.revisionIds, revisionId], status: "draft" }
    : { schemaVersion: REPORT_LIFECYCLE_SCHEMA_VERSION, id: nextReportId, caseId, reportType: "management", title: "Management Report", createdAt: now, scope, status: "draft", currentRevisionId: revisionId, approvedRevisionId: null, revisionIds: [revisionId] };
  const candidate = { schemaVersion: REPORT_LIBRARY_SCHEMA_VERSION, reports: { ...library.reports, [nextReportId]: manifest }, revisions: { ...library.revisions, [revisionId]: revision } };
  const candidateValidation = await validateReportLibraryIntegrity(candidate, { caseId });
  if (!candidateValidation.valid) throw new TypeError(`Management AI Draft is invalid: ${candidateValidation.errors.join(" ")}`);
  return { reportLibrary: candidate, manifest, revision };
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
  legacyImport = null,
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
  let legacyImportMetadata = null;
  if (legacyImport != null) {
    if (legacyImport?.origin !== "legacy_client_update_text" || legacyImport?.language !== clientLanguage || legacyImport?.historicalProvenance !== "unknown") {
      throw new TypeError("Legacy Client Update import metadata is invalid.");
    }
    legacyImportMetadata = {
      origin: "legacy_client_update_text",
      sourceSlot: requireText(legacyImport.sourceSlot, "Legacy Client Update source slot"),
      language: clientLanguage,
      historicalProvenance: "unknown",
      importedAt: now,
      snapshotKind: "present_day_case_snapshot",
    };
  }
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
      clientUpdate: {
        language: clientLanguage,
        acceptedNarrative: narrative,
        promptRevision: formatRevision,
        ...(legacyImportMetadata ? { legacyImport: legacyImportMetadata } : {}),
      },
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

export function isLegacyImportedClientUpdateRevision(revision) {
  const legacyImport = revision?.content?.clientUpdate?.legacyImport;
  return legacyImport?.origin === "legacy_client_update_text"
    && legacyImport?.historicalProvenance === "unknown"
    && legacyImport?.snapshotKind === "present_day_case_snapshot";
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

/** Lists unsnapshotted legacy text without mutating or inferring its provenance. */
export function getLegacyClientUpdateNarratives(caseItem) {
  const saved = getClientUpdateSavedDrafts(caseItem);
  const versioned = caseItem?.generatedReportVersions || {};
  const entries = [
    { language: "en", narrative: text(versioned.en) || text(caseItem?.generatedReportText), sourceSlot: text(versioned.en) ? "generatedReportVersions.en" : "generatedReportText" },
    { language: "de", narrative: text(versioned.de), sourceSlot: "generatedReportVersions.de" },
  ].filter((entry) => entry.narrative);
  return entries.filter((entry) => !saved.some((draft) => draft.revision.content.clientUpdate.language === entry.language
    && draft.revision.content.clientUpdate.acceptedNarrative === entry.narrative));
}

/** Creates an immutable, explicitly-labelled present-day snapshot from selected legacy text. */
export async function buildLegacyClientUpdateDraftCandidate({
  caseItem,
  language,
  legacyNarrative,
  reportDocument,
  markdown,
  json,
  sourceCaseRevision = caseItem?.revision,
  sourceFingerprint = reportDocument?.source?.sourceRevision?.fingerprint,
  provenance,
  now = new Date().toISOString(),
  createId = generateId,
} = {}) {
  const legacy = getLegacyClientUpdateNarratives(caseItem).find((entry) => entry.language === supportedClientLanguage(language)
    && entry.narrative === legacyNarrative);
  if (!legacy) throw new TypeError("The selected legacy Client Update text is unavailable or already has an immutable revision.");
  return buildClientUpdateDraftCandidate({
    caseItem,
    reportDocument,
    language: legacy.language,
    acceptedNarrative: legacy.narrative,
    markdown,
    json,
    sourceCaseRevision,
    sourceFingerprint,
    promptRevision: "legacy-format-unknown",
    provenance,
    legacyImport: { origin: "legacy_client_update_text", sourceSlot: legacy.sourceSlot, language: legacy.language, historicalProvenance: "unknown" },
    now,
    createId,
  });
}

/** Returns a validated, unpersisted library with only permitted lifecycle metadata changed. */
export async function buildClientUpdateLifecycleCandidate({
  caseItem,
  revisionId,
  toStatus,
  reviewerName = "",
  currentFingerprint,
  now = new Date().toISOString(),
} = {}) {
  const caseId = requireText(caseItem?.id, "Case ID");
  const selectedRevisionId = requireText(revisionId, "Client Update revision ID");
  const library = requireSupportedLibrary(caseItem?.reportLibrary, caseId);
  const integrity = await validateReportLibraryIntegrity(library, { caseId });
  if (!integrity.valid) throw new TypeError(`Client Update history is invalid: ${integrity.errors.join(" ")}`);
  const revision = library.revisions[selectedRevisionId];
  const manifest = revision ? library.reports[revision.reportId] : null;
  if (!manifest || manifest.reportType !== "client" || !isClientUpdateRevision(revision)) {
    throw new TypeError("The selected Client Update revision is unavailable or malformed.");
  }
  if (toStatus === "approved" && isLegacyImportedClientUpdateRevision(revision)) {
    throw new TypeError("A Client Update imported from legacy text has unknown historical provenance and cannot be approved as current.");
  }
  const transition = transitionReportLifecycle(
    { ...revision.lifecycle, revision },
    toStatus,
    {
      actor: { kind: "human", name: reviewerName },
      currentFingerprint,
      at: now,
    }
  );
  if (!transition.ok) throw new TypeError(transition.errors.join(" "));
  if (toStatus === "approved" && manifest.currentRevisionId !== revision.id) {
    throw new TypeError("Only the current Client Update revision can be approved. Open the current revision or create a new reviewable revision.");
  }
  const nextLifecycle = { ...transition.lifecycle };
  delete nextLifecycle.revision;
  const nextRevision = { ...revision, lifecycle: nextLifecycle };
  const nextManifest = manifest.currentRevisionId === revision.id
    ? {
      ...manifest,
      status: nextLifecycle.status,
      approvedRevisionId: nextLifecycle.status === "approved" ? revision.id : manifest.approvedRevisionId,
    }
    : manifest;
  const candidate = {
    schemaVersion: REPORT_LIBRARY_SCHEMA_VERSION,
    reports: { ...library.reports, [manifest.id]: nextManifest },
    revisions: { ...library.revisions, [revision.id]: nextRevision },
  };
  const validation = await validateReportLibraryIntegrity(candidate, { caseId });
  if (!validation.valid) throw new TypeError(`Client Update lifecycle update is invalid: ${validation.errors.join(" ")}`);
  return { reportLibrary: candidate, manifest: nextManifest, revision: nextRevision };
}
