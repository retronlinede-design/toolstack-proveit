import { normalizeCase } from "./caseDomain.js";
import { normalizeCaseIssues } from "./issueDomain.js";

// Shared load/import boundary: preserve canonical data before legacy compatibility.
export function normalizeStoredCase(caseItem, options = {}) {
  return normalizeCaseIssues(normalizeCase(caseItem), options).caseData;
}
