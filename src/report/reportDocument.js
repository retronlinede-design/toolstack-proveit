export const REPORT_DOCUMENT_SCHEMA_VERSION = 1;

const FORBIDDEN_KEYS = new Set([
  "blob", "file", "dataUrl", "backupDataUrl", "base64", "binary", "buffer", "bytes",
]);

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function createReportDocument({ definition, model, generatedAt, title, notices = [], summary = {}, sections = [] } = {}) {
  const safeDefinition = definition && typeof definition === "object" ? definition : {};
  const safeModel = model && typeof model === "object" ? model : {};
  const completenessNotices = safeDefinition.completeness === "bounded" ? [{
    code: "BOUNDED_REPORT",
    severity: "info",
    message: "This report is a bounded overview and does not contain every case record.",
  }] : [];
  return {
    schemaVersion: REPORT_DOCUMENT_SCHEMA_VERSION,
    report: {
      id: text(safeDefinition.id),
      title: text(title) || text(safeDefinition.label) || "Untitled Report",
      audience: text(safeDefinition.audience),
      completeness: text(safeDefinition.completeness) || "summary",
      generatedAt: generatedAt || safeModel.generatedAt || new Date().toISOString(),
    },
    source: {
      caseId: text(safeModel.sourceCase?.id),
      caseName: text(safeModel.sourceCase?.name),
      sourceRevision: safeModel.sourceRevision || { caseUpdatedAt: "", recordCount: 0, fingerprint: "" },
      scope: safeModel.scope || { type: "case", sequenceGroupName: null, isValid: true },
    },
    notices: [...completenessNotices, ...(Array.isArray(notices) ? notices : [])],
    summary: summary && typeof summary === "object" ? summary : {},
    sections: Array.isArray(sections) ? sections : [],
  };
}

function inspectValue(value, path, errors, seen) {
  if (typeof value === "function") {
    errors.push(`${path} contains a function.`);
    return;
  }
  if (typeof value === "symbol" || typeof value === "bigint") {
    errors.push(`${path} contains a non-serialisable value.`);
    return;
  }
  if (typeof value === "string" && /^data:/i.test(value.trim())) {
    errors.push(`${path} contains a data URL.`);
    return;
  }
  if (!value || typeof value !== "object") return;
  if (seen.has(value)) {
    errors.push(`${path} contains a circular reference.`);
    return;
  }
  if (Object.prototype.hasOwnProperty.call(value, "$$typeof")) {
    errors.push(`${path} contains a JSX-like value.`);
    return;
  }
  seen.add(value);
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.has(key)) errors.push(`${path}.${key} is a forbidden binary field.`);
    inspectValue(child, `${path}.${key}`, errors, seen);
  }
  seen.delete(value);
}

export function validateReportDocument(reportDocument) {
  const errors = [];
  if (!reportDocument || typeof reportDocument !== "object" || Array.isArray(reportDocument)) {
    return { valid: false, errors: ["Report document must be an object."] };
  }
  if (reportDocument.schemaVersion !== REPORT_DOCUMENT_SCHEMA_VERSION) errors.push("Unsupported or missing report document schema version.");
  if (!text(reportDocument.report?.id)) errors.push("Report ID is required.");
  if (!text(reportDocument.report?.title)) errors.push("Report title is required.");
  if (!text(reportDocument.source?.caseId) && reportDocument.source?.caseId !== "") errors.push("Source case ID must be a string or a safe empty value.");
  if (!['case', 'sequenceGroup'].includes(reportDocument.source?.scope?.type)) errors.push("Report scope is invalid.");
  if (!Array.isArray(reportDocument.sections)) errors.push("Report sections must be an array.");
  const sectionIds = new Set();
  for (const section of Array.isArray(reportDocument.sections) ? reportDocument.sections : []) {
    const sectionId = text(section?.id);
    if (!sectionId) errors.push("Every report section requires an ID.");
    else if (sectionIds.has(sectionId)) errors.push(`Duplicate report section ID: ${sectionId}.`);
    sectionIds.add(sectionId);
  }
  inspectValue(reportDocument, "reportDocument", errors, new WeakSet());
  try {
    JSON.stringify(reportDocument);
  } catch {
    errors.push("Report document cannot be serialised as JSON.");
  }
  return { valid: errors.length === 0, errors };
}

export function getReportDocumentSection(reportDocument, sectionId) {
  return (reportDocument?.sections || []).find((section) => section.id === sectionId) || null;
}
