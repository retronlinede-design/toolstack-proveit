export function buildFloatingToolActions({
  handleWorkspaceOpenSequenceGroups,
  handleWorkspaceOpenSequenceGroupAuditExport,
  handleWorkspaceOpenIncidentDateRepairTool,
}) {
  return [
    { label: "Open Issue Manager", onClick: handleWorkspaceOpenSequenceGroups },
    { label: "Open Issue Audit", onClick: handleWorkspaceOpenSequenceGroupAuditExport },
    { label: "Incident Date Repair Tool", onClick: handleWorkspaceOpenIncidentDateRepairTool },
  ];
}
