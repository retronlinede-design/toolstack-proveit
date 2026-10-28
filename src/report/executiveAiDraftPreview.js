import { validateAiBrief } from "./aiBrief.js";
import { validateAiDraft } from "./aiDraft.js";

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function text(value) { return typeof value === "string" ? value.trim() : ""; }
function scopeFromBrief(brief) { const scope = brief?.scope || {}; if (scope.type === "case") return { type: "case", label: scope.label || "Entire case" }; if (scope.type === "issue" && text(scope.issueId)) return { type: "sequenceGroup", issueId: scope.issueId, issueReference: scope.issueReference || "", issueName: scope.issueName || "", label: scope.label || scope.issueName || "Selected Issue" }; throw new TypeError("Executive AI Brief scope is unavailable or invalid."); }
function sectionItems(draft, section) { return (section.claimIds || []).map((id) => draft.claims.find((claim) => claim.id === id)).filter(Boolean).map((claim) => ({ ...clone(claim), title: claim.text })); }

/** Adapts one validated, bound Executive AI Draft into a presentation-only report document. */
export function buildExecutiveAiDraftPreview({ draft, brief, validation, freshness = "unknown" } = {}) {
  const briefCheck = validateAiBrief(brief); if (!briefCheck.valid) throw new TypeError(`Executive AI Brief is invalid: ${briefCheck.errors.join(" ")}`);
  if (brief.requestedReportFamily !== "executive") throw new TypeError("Executive AI Draft preview requires an Executive AI Brief.");
  if (!validation?.valid) throw new TypeError("Validate the Executive AI Draft before previewing it.");
  const revalidated = validateAiDraft(draft, brief); if (!revalidated.valid || revalidated.normalisedDraft?.reportFamily !== "executive") throw new TypeError("Executive AI Draft does not match its original Executive AI Brief.");
  const normalised = revalidated.normalisedDraft; const scope = scopeFromBrief(brief);
  return { schemaVersion: 1, kind: "executive-ai-draft-preview", report: { id: "executive", title: "Executive Report", generatedAt: brief.generationMetadata?.createdAt || brief.source.caseRevision || null }, source: { caseId: brief.case.id, caseName: brief.case.name, scope, sourceRevision: { fingerprint: brief.source.sourceFingerprint, caseUpdatedAt: brief.source.caseRevision } }, presentation: { scope: scope.label, documentStatus: "AI Draft — not approved", confidentiality: "Confidential case material", aiAssistance: "Externally drafted AI narrative requiring human review" }, summary: { scopeLabel: scope.label, issue: scope.type === "sequenceGroup" ? { id: scope.issueId, reference: scope.issueReference, name: scope.issueName, displayLabel: [scope.issueReference, scope.issueName].filter(Boolean).join(" — ") } : null }, aiDraftPreview: { draft: clone(normalised), warnings: clone(revalidated.warnings), reviewReasons: [...new Set(revalidated.reviewReasons)], freshness, sourceFingerprint: brief.source.sourceFingerprint, sourceRevision: brief.source.caseRevision, sections: normalised.sections.map((section) => ({ id: section.id, heading: section.heading, narrative: section.narrative, claims: sectionItems(normalised, section) })), unresolvedQuestions: clone(normalised.unresolvedQuestions), evidenceGaps: clone(normalised.evidenceGaps), recommendations: clone(normalised.recommendations) }, sections: [], notices: [], appendices: [] };
}

export function isExecutiveAiDraftPreview(value) { return Boolean(value?.kind === "executive-ai-draft-preview" && value?.report?.id === "executive" && value?.aiDraftPreview?.draft?.reportFamily === "executive" && text(value?.source?.caseId) && text(value?.aiDraftPreview?.sourceFingerprint)); }
