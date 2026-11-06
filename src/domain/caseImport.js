import { mergeCase } from "./caseDomain.js";
import { normalizeCaseIssues } from "./issueDomain.js";
import { getSequenceGroupMetaForCase } from "../sequenceGroupMeta.js";
import { getHighestCaseRevision } from "./caseRevision.js";
import { mergeIntelligenceLibraries } from "../caseIntelligence/intelligenceLibrary.js";

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

// Restore-only asynchronous merge boundary. It retains the established
// synchronous case-import helper for legacy callers while requiring the strict
// immutable Intelligence Library contract whenever an import carries one.
export async function mergeImportedCasesWithIntelligence(currentCases, incomingCases, sequenceGroupMeta = {}) {
  const casesById = new Map(currentCases.map((caseItem) => [caseItem.id, caseItem]));
  const normalizedCases = [];
  for (const incoming of incomingCases) {
    const current = casesById.get(incoming.id) || {};
    const incomingWithoutIntelligenceLibrary = { ...(incoming || {}) };
    delete incomingWithoutIntelligenceLibrary.intelligenceLibrary;
    const merged = mergeCase(current, incomingWithoutIntelligenceLibrary);
    const intelligenceLibrary = await mergeIntelligenceLibraries(
      current?.intelligenceLibrary,
      incoming?.intelligenceLibrary,
      { caseId: merged.id || current.id || incoming.id || "" },
    );
    if (intelligenceLibrary !== undefined) merged.intelligenceLibrary = intelligenceLibrary;
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
