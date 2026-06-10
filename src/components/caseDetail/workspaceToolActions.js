export function buildFloatingToolActions({
  handleWorkspaceOpenSequenceGroups,
  handleWorkspaceOpenSequenceGroupAuditExport,
  handleWorkspaceOpenIncidentDateRepairTool,
}) {
  return [
    { label: "Open Sequence Group Manager", onClick: handleWorkspaceOpenSequenceGroups },
    { label: "Open Sequence Group Audit", onClick: handleWorkspaceOpenSequenceGroupAuditExport },
    { label: "Incident Date Repair Tool", onClick: handleWorkspaceOpenIncidentDateRepairTool },
  ];
}
