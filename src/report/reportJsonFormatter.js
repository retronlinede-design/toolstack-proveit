export function formatReportDocumentAsJson(reportDocument) {
  return JSON.stringify(reportDocument && typeof reportDocument === "object" ? reportDocument : {}, null, 2);
}
