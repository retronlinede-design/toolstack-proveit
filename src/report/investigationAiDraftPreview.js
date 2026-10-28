import { validateAiBrief } from "./aiBrief.js";
import { validateAiDraft } from "./aiDraft.js";

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function text(value) { return typeof value === "string" ? value.trim() : ""; }
function scopeFromBrief(brief) { const scope = brief?.scope || {}; if (scope.type === "case") return { type: "case", label: scope.label || "Whole case" }; if (scope.type === "issue" && text(scope.issueId)) return { type: "sequenceGroup", issueId: scope.issueId, issueReference: scope.issueReference || "", issueName: scope.issueName || "", label: scope.label || scope.issueName || "Selected Issue" }; throw new TypeError("Investigation AI Brief scope is unavailable or invalid."); }
function claimsForSection(draft, section) { return (section.claimIds || []).map((id) => draft.claims.find((claim) => claim.id === id)).filter(Boolean).map(clone); }

/** A detached, pure presentation model for a validated Investigation AI Draft. */
export function buildInvestigationAiDraftPreview({ draft, brief, validation, freshness = "unknown" } = {}) {
  const briefCheck = validateAiBrief(brief); if (!briefCheck.valid) throw new TypeError(`Investigation AI Brief is invalid: ${briefCheck.errors.join(" ")}`);
  if (brief.requestedReportFamily !== "investigation") throw new TypeError("Investigation AI Draft preview requires an Investigation AI Brief.");
  if (!validation?.valid) throw new TypeError("Validate the Investigation AI Draft before previewing it.");
  const revalidated = validateAiDraft(draft, brief); if (!revalidated.valid || revalidated.normalisedDraft?.reportFamily !== "investigation") throw new TypeError("Investigation AI Draft does not match its original Investigation AI Brief.");
  const normalised = revalidated.normalisedDraft; const scope = scopeFromBrief(brief);
  return { schemaVersion: 1, kind: "investigation-ai-draft-preview", report: { id: "investigation", title: "Investigation Report", generatedAt: brief.generationMetadata?.createdAt || brief.source.caseRevision || null }, source: { caseId: brief.case.id, caseName: brief.case.name, scope, sourceRevision: { fingerprint: brief.source.sourceFingerprint, caseUpdatedAt: brief.source.caseRevision } }, presentation: { scope: scope.label, documentStatus: "AI Draft — not approved", confidentiality: "Confidential case material", aiAssistance: "Externally drafted AI narrative requiring human review" }, summary: { scopeLabel: scope.label, issue: scope.type === "sequenceGroup" ? { id: scope.issueId, reference: scope.issueReference, name: scope.issueName, displayLabel: [scope.issueReference, scope.issueName].filter(Boolean).join(" — ") } : null }, aiDraftPreview: { draft: clone(normalised), warnings: clone(revalidated.warnings), reviewReasons: [...new Set(revalidated.reviewReasons)], freshness, sourceFingerprint: brief.source.sourceFingerprint, sourceRevision: brief.source.caseRevision, sections: normalised.sections.map((section) => ({ id: section.id, heading: section.heading, narrative: section.narrative, claims: claimsForSection(normalised, section) })), unresolvedQuestions: clone(normalised.unresolvedQuestions), evidenceGaps: clone(normalised.evidenceGaps), recommendations: clone(normalised.recommendations) }, sections: [], notices: [], appendices: [] };
}

export function isInvestigationAiDraftPreview(value) { return Boolean(value?.kind === "investigation-ai-draft-preview" && value?.report?.id === "investigation" && value?.aiDraftPreview?.draft?.reportFamily === "investigation" && text(value?.source?.caseId) && text(value?.aiDraftPreview?.sourceFingerprint)); }
