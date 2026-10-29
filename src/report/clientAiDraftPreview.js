import { validateAiBrief } from "./aiBrief.js";
import { validateAiDraft } from "./aiDraft.js";

const LANGUAGES = new Set(["en", "de"]);
const clone = (value) => JSON.parse(JSON.stringify(value));

/** Creates a detached whole-case Client Update presentation from one validated AI Draft. */
export function buildClientAiDraftPreview({ draft, brief, validation, language, freshness = "unknown" } = {}) {
  if (!LANGUAGES.has(language)) throw new TypeError("Client AI Draft language must be en or de.");
  const briefCheck = validateAiBrief(brief);
  if (!briefCheck.valid || brief?.requestedReportFamily !== "client") throw new TypeError("Client AI Draft preview requires a valid Client AI Brief.");
  if (brief.scope?.type !== "case") throw new TypeError("Client Update AI Drafts support whole-case scope only.");
  if (!validation?.valid) throw new TypeError("Validate the Client AI Draft before previewing it.");
  const checked = validateAiDraft(draft, brief);
  if (!checked.valid || checked.normalisedDraft?.reportFamily !== "client" || checked.normalisedDraft?.scope?.type !== "case") throw new TypeError("Client AI Draft does not match its original whole-case Client AI Brief.");
  const normalised = clone(checked.normalisedDraft);
  const claims = new Map(normalised.claims.map((claim) => [claim.id, claim]));
  return {
    kind: "client-ai-draft-preview",
    report: { id: "client", title: "Client Update", generatedAt: brief.generationMetadata?.createdAt || brief.source.caseRevision || null },
    source: { caseId: brief.case.id, caseName: brief.case.name, scope: { type: "case", label: "Whole case" }, sourceRevision: { fingerprint: brief.source.sourceFingerprint, caseUpdatedAt: brief.source.caseRevision } },
    presentation: { scope: "Whole case", documentStatus: "AI Draft — not approved", confidentiality: "Confidential case material", language: language.toUpperCase(), aiAssistance: "Externally drafted AI narrative requiring human review" },
    narrativeMetadata: { source: "ai_assisted", revisionState: ["current", "stale", "unknown"].includes(freshness) ? freshness : "unknown", reviewed: false, approved: false },
    aiDraftPreview: {
      language, draft: normalised, freshness: ["current", "stale", "unknown"].includes(freshness) ? freshness : "unknown", sourceFingerprint: brief.source.sourceFingerprint, sourceRevision: brief.source.caseRevision,
      warnings: clone(checked.warnings), reviewReasons: [...new Set(checked.reviewReasons)], claims: clone(normalised.claims),
      sections: normalised.sections.map((section) => ({ ...section, claims: section.claimIds.map((id) => claims.get(id)).filter(Boolean) })),
      unresolvedQuestions: clone(normalised.unresolvedQuestions), evidenceGaps: clone(normalised.evidenceGaps), recommendations: clone(normalised.recommendations),
    }, sections: [], notices: [], appendices: [],
  };
}

export function isClientAiDraftPreview(value) {
  return Boolean(value?.kind === "client-ai-draft-preview" && value?.report?.id === "client" && LANGUAGES.has(value?.aiDraftPreview?.language) && value?.aiDraftPreview?.draft?.reportFamily === "client" && value?.source?.scope?.type === "case");
}
