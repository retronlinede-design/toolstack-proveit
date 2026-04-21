function safeText(value) {
  return typeof value === "string" ? value : "";
}

function isTrackingRecordDocument(doc) {
  return typeof doc?.textContent === "string" && doc.textContent.includes("[TRACK RECORD]");
}

function getSection(text = "", startMarker, endMarker = null) {
  if (!text || !startMarker) return "";
  const start = text.indexOf(startMarker);
  if (start === -1) return "";
  const from = start + startMarker.length;
  const rest = text.slice(from);
  if (!endMarker) return rest.trim();
  const end = rest.indexOf(endMarker);
  return end === -1 ? rest.trim() : rest.slice(0, end).trim();
}

function getTrackingMetaValue(text = "", key = "") {
  const metaText = getSection(text, "meta:", "--- TABLE ---");
  const line = metaText
    .split("\n")
    .map((item) => item.trim())
    .find((item) => item.toLowerCase().startsWith(`${key.toLowerCase()}:`));
  return line ? line.slice(line.indexOf(":") + 1).trim() : "";
}

function getTrackingRecordTypeLabel(metaType = "") {
  const value = String(metaType || "").toLowerCase();
  if (value === "payment_tracker") return "Financial";
  if (value === "work_time") return "Work Time";
  if (value === "compliance") return "Compliance";
  if (value === "custom") return "Custom";
  return metaType || "Record";
}

function buildTrackingRecordMeta(doc) {
  return {
    type: getTrackingMetaValue(doc?.textContent || "", "type"),
    subject: getTrackingMetaValue(doc?.textContent || "", "subject"),
  };
}

function buildTrackingRecordSummary(doc) {
  const summaryText = getSection(doc?.textContent || "", "--- SUMMARY (GPT READY) ---", "--- FILE LINKS ---");
  const notesText = getSection(doc?.textContent || "", "--- NOTES ---");
  return summaryText || buildTrackingRecordMeta(doc).subject || notesText || safeText(doc?.summary) || safeText(doc?.source);
}

function buildDisplayMeta(record, recordType, typeLabel, summary) {
  return {
    id: record.id,
    recordType,
    typeLabel,
    title: record.title || record.label || "",
    date: record.eventDate || record.date || record.documentDate || record.dueDate || record.paymentDate || record.createdAt || "",
    summary: safeText(summary),
    record,
  };
}

function buildDocumentDisplayMeta(record) {
  if (isTrackingRecordDocument(record)) {
    const meta = buildTrackingRecordMeta(record);
    return buildDisplayMeta(
      record,
      "document",
      getTrackingRecordTypeLabel(meta.type),
      buildTrackingRecordSummary(record)
    );
  }

  return buildDisplayMeta(
    record,
    "document",
    "Document",
    record.summary || record.source || record.textContent || ""
  );
}

export function resolveIncidentById(caseData, id) {
  const record = (caseData?.incidents || []).find((item) => item.id === id);
  return record ? buildDisplayMeta(record, "incident", "Incident", record.description || record.notes || "") : null;
}

export function resolveEvidenceById(caseData, id) {
  const record = (caseData?.evidence || []).find((item) => item.id === id);
  return record ? buildDisplayMeta(record, "evidence", "Evidence", record.functionSummary || record.description || record.notes || "") : null;
}

export function resolveRecordById(caseData, id) {
  if (!caseData || !id) return null;

  const evidence = resolveEvidenceById(caseData, id);
  if (evidence) return evidence;

  const incident = resolveIncidentById(caseData, id);
  if (incident) return incident;

  const strategy = (caseData.strategy || []).find((item) => item.id === id);
  if (strategy) return buildDisplayMeta(strategy, "strategy", "Strategy", strategy.description || strategy.notes || "");

  const task = (caseData.tasks || []).find((item) => item.id === id);
  if (task) return buildDisplayMeta(task, "task", "Task", task.description || task.notes || "");

  const document = (caseData.documents || []).find((item) => item.id === id);
  if (document) return buildDocumentDisplayMeta(document);

  const ledger = (caseData.ledger || []).find((item) => item.id === id);
  if (ledger) return buildDisplayMeta(ledger, "ledger", "Ledger", ledger.notes || ledger.counterparty || "");

  return null;
}

export function getRecordDisplayMeta(caseData, id) {
  return resolveRecordById(caseData, id);
}

export function getIncidentDisplayMeta(caseData, id) {
  return resolveIncidentById(caseData, id);
}

export function getEvidenceDisplayMeta(caseData, id) {
  return resolveEvidenceById(caseData, id);
}
