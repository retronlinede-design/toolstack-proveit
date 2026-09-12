import { mergeCase } from "./caseDomain.js";
import { normalizeCaseIssues } from "./issueDomain.js";
import { getSequenceGroupMetaForCase } from "../sequenceGroupMeta.js";
import { getHighestCaseRevision } from "./caseRevision.js";

// Shared by selected-case and full-app import. Incoming cases must still carry
// raw property presence (binary references may already have been remapped).
export function mergeImportedCases(currentCases, incomingCases, sequenceGroupMeta = {}) {
  const casesById = new Map(currentCases.map((caseItem) => [caseItem.id, caseItem]));
  const normalizedCases = [];
  for (const incoming of incomingCases) {
    const current = casesById.get(incoming.id) || {};
    const merged = mergeCase(current, incoming);
    const preservedRevision = getHighestCaseRevision(current, incoming);
    if (preservedRevision != null) merged.revision = preservedRevision;
    const normalized = normalizeCaseIssues(merged, {
      sequenceGroupMeta: getSequenceGroupMetaForCase(merged.id, sequenceGroupMeta),
    }).caseData;
    casesById.set(normalized.id, normalized);
    normalizedCases.push(normalized);
  }
  return { mergedCases: [...casesById.values()], normalizedCases };
}
