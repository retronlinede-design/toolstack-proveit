export function buildFloatingToolActions({
  handleWorkspaceOpenSequenceGroups,
  handleWorkspaceOpenSequenceGroupAuditExport,
  handleWorkspaceOpenIncidentDateRepairTool,
}) {
  return [
    { label: "Manage sequence groups", onClick: handleWorkspaceOpenSequenceGroups },
    { label: "Sequence Group Audit Export", onClick: handleWorkspaceOpenSequenceGroupAuditExport },
    { label: "Incident Date Repair Tool", onClick: handleWorkspaceOpenIncidentDateRepairTool },
  ];
}
