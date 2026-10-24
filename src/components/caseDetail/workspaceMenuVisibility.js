export function shouldShowFloatingWorkspaceMenu({
  selectedCase,
  isCaseCurrentlyLocked = false,
  actionSummaryEditOpen = false,
  sequenceGroupManagerOpen = false,
  sequenceGroupAuditExportOpen = false,
  incidentDateRepairOpen = false,
  activeLedgerRecord = null,
} = {}) {
  return Boolean(
    selectedCase &&
      !isCaseCurrentlyLocked &&
      !actionSummaryEditOpen &&
      !sequenceGroupManagerOpen &&
      !sequenceGroupAuditExportOpen &&
      !incidentDateRepairOpen &&
      !activeLedgerRecord
  );
}
