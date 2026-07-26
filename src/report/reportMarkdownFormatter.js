import { getReportDocumentSection } from "./reportDocument.js";

function safeText(value) {
  if (value == null) return "";
  if (["string", "number", "boolean"].includes(typeof value)) {
    return String(value).replace(/data:[^\s)]+/gi, "[binary content omitted]");
  }
  return JSON.stringify(value).replace(/data:[^\s)"}]+/gi, "[binary content omitted]");
}

function inline(value) {
  return safeText(value).replace(/\|/g, "\\|").replace(/\r?\n/g, "<br>").trim() || "-";
}

function listLines(items, render) {
  return items.length ? items.map((item) => `- ${render(item)}`) : ["- None"];
}

export function formatReportDocumentAsMarkdown(reportDocument = {}) {
  const summary = reportDocument.summary || {};
  const source = reportDocument.source || {};
  const schedule = getReportDocumentSection(reportDocument, "evidence-schedule")?.rows || [];
  const incidents = getReportDocumentSection(reportDocument, "supported-incidents")?.items || [];
  const weak = getReportDocumentSection(reportDocument, "weak-unlinked-evidence")?.diagnostics || {};
  const unresolved = getReportDocumentSection(reportDocument, "unresolved-references")?.items || [];
  const notices = reportDocument.notices || [];
  const scope = source.scope?.type === "sequenceGroup" ? `Sequence Group: ${source.scope.sequenceGroupName || "-"}` : "Whole case";
  const lines = [
    `# ${inline(reportDocument.report?.title || "Evidence Pack")}`,
    "",
    "## Case Details",
    "",
    `- Case: ${inline(source.caseName || source.caseId)}`,
    `- Case ID: ${inline(source.caseId)}`,
    `- Status: ${inline(summary.caseOverview?.status)}`,
    `- Category: ${inline(summary.caseOverview?.category)}`,
    `- Generated: ${inline(reportDocument.report?.generatedAt)}`,
    `- Source revision: ${inline(source.sourceRevision?.fingerprint)}`,
    "",
    "## Report Scope",
    "",
    `- Scope: ${inline(scope)}`,
    `- Completeness: ${inline(reportDocument.report?.completeness)}`,
    `- Evidence records: ${inline(summary.includedEvidenceCount ?? 0)}`,
    `- Incidents in primary scope: ${inline(summary.scopedIncidentCount ?? 0)}`,
    `- Archived records: ${inline(summary.archivedPolicy)}`,
    "",
    "## Evidence Schedule",
    "",
  ];
  if (schedule.length === 0) lines.push("No evidence is included in this scope.");
  else {
    lines.push("| Evidence ID | Title | Date | Status | Verification | Role / Type | Function summary | Linked incidents | Attachments | Archived |", "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |");
    schedule.forEach((row) => lines.push(`| ${inline(row.evidenceId)} | ${inline(row.title)} | ${inline(row.date)} | ${inline(row.status)} | ${inline(row.verificationState)} | ${inline(row.evidenceRole || row.evidenceType)} | ${inline(row.functionSummary)} | ${inline((row.linkedIncidentTitles || []).join(", "))} | ${inline((row.attachmentFilenames || []).join(", "))} | ${inline(row.archived ? "Yes" : "No")} |`));
  }
  lines.push("", "## Supported Incidents", "", ...listLines(incidents, (incident) => `${inline(incident.id)} — ${inline(incident.title)} — evidence: ${inline((incident.supportingEvidenceIds || []).join(", "))}`));
  lines.push("", "## Weak or Unlinked Evidence", "", "### Not linked to incidents", ...listLines(weak.unlinkedEvidence || [], (item) => `${inline(item.id)} — ${inline(item.title)}`));
  lines.push("", "### Missing function summary", ...listLines(weak.evidenceMissingFunctionSummary || [], (item) => `${inline(item.id)} — ${inline(item.title)}`));
  lines.push("", "### No attachments", ...listLines(weak.evidenceWithoutAttachments || [], (item) => `${inline(item.id)} — ${inline(item.title)}`));
  lines.push("", "## Unresolved References", "", ...listLines(unresolved, (item) => `${inline(item.sourceRecordType)} ${inline(item.sourceRecordId)} — ${inline(item.message)} — technical reference: ${inline(item.targetId)}`));
  lines.push("", "## Notices", "", ...listLines(notices, (notice) => `${inline(notice.code)}: ${inline(notice.message)}`), "", "Attachments are metadata-only; attachment content is not embedded.", "");
  return lines.join("\n");
}
