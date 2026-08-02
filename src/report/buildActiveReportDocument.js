import { buildChronologyReportDocument } from "./chronologyReportDocument.js";
import { buildCaseAuditDocument } from "./caseAuditDocument.js";
import { buildDocumentScheduleDocument } from "./documentScheduleDocument.js";
import { buildEvidenceScheduleDocument } from "./evidenceScheduleDocument.js";
import { buildIncidentScheduleDocument } from "./incidentScheduleDocument.js";
import { buildInvestigationReportDocument } from "./investigationReportDocument.js";
import { buildLedgerScheduleDocument } from "./ledgerScheduleDocument.js";

const BUILDERS = {
  investigation: buildInvestigationReportDocument,
  evidence: buildEvidenceScheduleDocument,
  document: buildDocumentScheduleDocument,
  ledger: buildLedgerScheduleDocument,
  incidentSchedule: buildIncidentScheduleDocument,
  chronologyReport: buildChronologyReportDocument,
  caseAudit: buildCaseAuditDocument,
};

export function buildActiveReportDocument({ reportId, reportModel, definition, generatedAt } = {}) {
  const builder = BUILDERS[reportId];
  if (!builder) return { supported: false, reportDocument: null, error: `Report "${reportId || "unknown"}" does not use the shared report-document runtime.` };
  return { supported: true, reportDocument: builder(reportModel, definition, { generatedAt }), error: "" };
}

export function reportHasDocumentBuilder(reportId) { return Boolean(BUILDERS[reportId]); }
