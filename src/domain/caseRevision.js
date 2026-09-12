export const INITIAL_CASE_REVISION = 1;

export function getCaseRevision(caseItem) {
  const revision = caseItem?.revision;
  return Number.isSafeInteger(revision) && revision >= INITIAL_CASE_REVISION ? revision : null;
}

export function getHighestCaseRevision(...caseItems) {
  const revisions = caseItems.map(getCaseRevision).filter((revision) => revision != null);
  return revisions.length ? Math.max(...revisions) : null;
}
