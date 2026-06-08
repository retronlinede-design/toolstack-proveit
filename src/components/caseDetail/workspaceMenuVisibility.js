export function shouldShowFloatingWorkspaceMenu({
  selectedCase,
  isCaseCurrentlyLocked = false,
  actionSummaryEditOpen = false,
  aiToolsOpen = false,
  sequenceGroupManagerOpen = false,
  sequenceGroupAuditExportOpen = false,
  incidentDateRepairOpen = false,
  activeLedgerRecord = null,
} = {}) {
  return Boolean(
    selectedCase &&
      !isCaseCurrentlyLocked &&
      !actionSummaryEditOpen &&
      !aiToolsOpen &&
      !sequenceGroupManagerOpen &&
      !sequenceGroupAuditExportOpen &&
      !incidentDateRepairOpen &&
      !activeLedgerRecord
  );
}
