import { createReportDocument } from "./reportDocument.js";

const TYPES = ["incident", "evidence", "document", "ledger", "strategy", "watch"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
function ref(type, id) { return `${type}:${id}`; }

export function buildChronologyReportDocument(reportModel, definition, options = {}) {
  const model = reportModel && typeof reportModel === "object" ? reportModel : {};
  const byReference = new Map((model.records?.primaryScopedRecords || []).map((record) => [ref(record.type, record.id), record]));
  const entries = (model.chronology || []).map((item) => {
    const record = byReference.get(ref(item.recordType, item.recordId)) || {};
    return { ...item, originalDate: record.eventDate || record.loggedDate || item.date, status: record.status || "", resolvedPartyNames: (record.resolvedParties || []).filter((party) => !party.unresolved).map((party) => party.name).filter(Boolean), linkedRecordCount: (record.links || []).filter((link) => link.status === "resolved").length, attachmentCount: (record.attachmentMetadata || []).length };
  });
  const datedGroups = [];
  const datedByMonth = new Map();
  entries.filter((entry) => entry.dateStatus === "valid").forEach((entry) => {
    const date = new Date(entry.date);
    const year = date.getUTCFullYear(); const month = date.getUTCMonth() + 1; const id = `month-${year}-${String(month).padStart(2, "0")}`;
    if (!datedByMonth.has(id)) { const group = { id, label: `${MONTHS[month - 1]} ${year}`, groupType: "month", year, month, entries: [] }; datedByMonth.set(id, group); datedGroups.push(group); }
    datedByMonth.get(id).entries.push(entry);
  });
  const malformed = entries.filter((entry) => entry.dateStatus === "malformed");
  const missing = entries.filter((entry) => entry.dateStatus === "missing");
  const groups = [...datedGroups];
  if (malformed.length) groups.push({ id: "malformed-dates", label: "Malformed Dates", groupType: "malformed", year: null, month: null, entries: malformed });
  if (missing.length) groups.push({ id: "missing-dates", label: "Missing Dates", groupType: "missing", year: null, month: null, entries: missing });
  const valid = entries.filter((entry) => entry.dateStatus === "valid");
  const notices = [
    { code: "ARCHIVED_POLICY", severity: "info", message: definition?.includeArchived === false ? "Archived records are excluded." : "Archived records are included when present in the selected scope." },
  ];
  if (model.scope?.type === "sequenceGroup") notices.push({ code: "DIRECT_ASSIGNMENT_SCOPE", severity: "info", message: "This chronology contains records directly assigned to the selected Sequence Group. Linked records assigned elsewhere are not automatically added." });
  const countByRecordType = Object.fromEntries(TYPES.map((type) => [type, entries.filter((entry) => entry.recordType === type).length]));
  const summary = { caseOverview: model.sourceCase || {}, scopeLabel: model.scope?.type === "sequenceGroup" ? `Sequence Group: ${model.scope.sequenceGroupName || ""}` : "Whole case", totalChronologyEntries: entries.length, validDateCount: valid.length, malformedDateCount: malformed.length, missingDateCount: missing.length, archivedEntryCount: entries.filter((entry) => entry.archived).length, groupedEntryCount: entries.filter((entry) => entry.sequenceGroup).length, ungroupedEntryCount: entries.filter((entry) => !entry.sequenceGroup).length, earliestValidDate: valid[0]?.date || "", latestValidDate: valid.at(-1)?.date || "", countByRecordType, archivedPolicy: definition?.includeArchived === false ? "excluded" : "included" };
  return createReportDocument({ definition, model, generatedAt: options.generatedAt, title: definition?.label || "Chronology Report", notices, summary, sections: [
    { id: "case-overview", heading: "Case Details", type: "summary", metadata: model.sourceCase || {} },
    { id: "chronology-summary", heading: "Summary", type: "metrics", metadata: summary },
    { id: "record-type-totals", heading: "Record Type Totals", type: "metrics", metadata: countByRecordType },
    { id: "chronology", heading: "Chronology", type: "chronology", groups },
    { id: "notices", heading: "Notices", type: "narrative", items: notices },
  ] });
}
