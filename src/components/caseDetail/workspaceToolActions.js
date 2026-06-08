export function buildFloatingToolActions({
  handleWorkspaceOpenSequenceGroups,
  handleWorkspaceOpenSequenceGroupAuditExport,
  handleWorkspaceOpenIncidentDateRepairTool,
  openAiTools,
}) {
  return [
    { label: "Manage sequence groups", onClick: handleWorkspaceOpenSequenceGroups },
    { label: "AI Tools", onClick: openAiTools },
    { label: "Sequence Group Audit Export", onClick: handleWorkspaceOpenSequenceGroupAuditExport },
    { label: "Incident Date Repair Tool", onClick: handleWorkspaceOpenIncidentDateRepairTool },
  ];
}
