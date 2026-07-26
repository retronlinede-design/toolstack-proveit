import { buildChronologyReportDocument } from "./chronologyReportDocument.js";
import { buildDocumentScheduleDocument } from "./documentScheduleDocument.js";
import { buildEvidenceScheduleDocument } from "./evidenceScheduleDocument.js";
import { buildIncidentScheduleDocument } from "./incidentScheduleDocument.js";
import { buildLedgerScheduleDocument } from "./ledgerScheduleDocument.js";

const BUILDERS = {
  evidence: buildEvidenceScheduleDocument,
  document: buildDocumentScheduleDocument,
  ledger: buildLedgerScheduleDocument,
  incidentSchedule: buildIncidentScheduleDocument,
  chronologyReport: buildChronologyReportDocument,
};

export function buildActiveReportDocument({ reportId, reportModel, definition, generatedAt } = {}) {
  const builder = BUILDERS[reportId];
  if (!builder) return { supported: false, reportDocument: null, error: `Report "${reportId || "unknown"}" does not use the shared report-document runtime.` };
  return { supported: true, reportDocument: builder(reportModel, definition, { generatedAt }), error: "" };
}

export function reportHasDocumentBuilder(reportId) { return Boolean(BUILDERS[reportId]); }
