import { validateAiBrief } from "./aiBrief.js";
import { validateAiDraft } from "./aiDraft.js";

function safeArray(value) { return Array.isArray(value) ? value : []; }
function clone(value) { return structuredClone(value); }

function ensurePreviewInput({ draft, brief, validation }) {
  if (!validation?.valid || !validation.normalisedDraft) throw new Error("Validate the AI Draft against its prepared AI Brief before previewing it.");
  if (!brief || !validateAiBrief(brief).valid) throw new Error("The original prepared AI Brief is unavailable or invalid.");
  const resolvedDraft = draft || validation.normalisedDraft;
  const revalidated = validateAiDraft(resolvedDraft, brief);
  if (!revalidated.valid) throw new Error("The AI Draft no longer matches its original AI Brief.");
  if (revalidated.normalisedDraft.reportFamily !== "management") throw new Error("Only validated Management AI Drafts can be previewed here.");
  return revalidated;
}

function sourceReferences(items, claimsById) {
  const references = [];
  for (const item of items) for (const claimId of safeArray(item.claimIds)) references.push(...safeArray(claimsById.get(claimId)?.sourceReferences));
  return references;
}

/** Presentation-only model. It does not call the canonical Management builder or retain live case data. */
export function buildManagementAiDraftPreview({ draft, brief, validation, freshness = "unknown" }) {
  const revalidated = ensurePreviewInput({ draft, brief, validation });
  const validatedDraft = clone(revalidated.normalisedDraft);
  const claimsById = new Map(validatedDraft.claims.map((claim) => [claim.id, claim]));
  const sections = validatedDraft.sections.map((section) => ({
    id: section.id, heading: section.heading, narrative: section.narrative,
    claims: safeArray(section.claimIds).map((id) => claimsById.get(id)).filter(Boolean),
    sourceReferences: sourceReferences([section], claimsById),
  }));
  const scope = brief.scope?.type === "issue"
    ? { type: "sequenceGroup", issueId: brief.scope.issueId, issueReference: brief.scope.issueReference, issueName: brief.scope.issueName, label: brief.scope.label }
    : { type: "case", label: "Whole case" };
  return {
    kind: "management-ai-draft-preview",
    report: { id: "management", title: "Management Report", generatedAt: brief.generationMetadata?.createdAt || brief.source.caseRevision || null },
    source: { caseId: brief.case.id, caseName: brief.case.name, scope, sourceRevision: { fingerprint: brief.source.sourceFingerprint, caseUpdatedAt: brief.source.caseRevision } },
    presentation: { documentStatus: "AI Draft — human review required", confidentiality: "Case material", scope: scope.label || "Whole case" },
    aiDraftPreview: {
      freshness: ["current", "stale", "unknown"].includes(freshness) ? freshness : "unknown", draft: validatedDraft, sections,
      claims: validatedDraft.claims, unresolvedQuestions: validatedDraft.unresolvedQuestions, evidenceGaps: validatedDraft.evidenceGaps, recommendations: validatedDraft.recommendations,
      warnings: clone(revalidated.warnings), reviewReasons: [...new Set(revalidated.reviewReasons)], sourceFingerprint: brief.source.sourceFingerprint, sourceRevision: brief.source.caseRevision,
    },
  };
}

export function isManagementAiDraftPreview(value) {
  return value?.kind === "management-ai-draft-preview" && value?.aiDraftPreview?.draft?.reportFamily === "management";
}
