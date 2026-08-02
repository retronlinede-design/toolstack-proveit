import { formatReportDocumentAsJson } from "./reportJsonFormatter.js";
import { formatReportDocumentAsMarkdown } from "./reportMarkdownFormatter.js";

export function sanitiseReportFilenamePart(value, fallback = "report") {
  const safe = String(value || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
  return safe || fallback;
}

export function getReportOutputFilename(document, format) {
  const extension = format === "markdown" ? "md" : format === "json" ? "json" : "txt";
  const caseName = sanitiseReportFilenamePart(document?.source?.caseName || document?.source?.caseId, "untitled-case");
  const reportId = sanitiseReportFilenamePart(document?.report?.id, "report");
  const scope = document?.source?.scope?.type === "sequenceGroup" ? `-${sanitiseReportFilenamePart(document.source.scope.issueReference || document.source.scope.sequenceGroupName, "issue")}` : "";
  const date = String(document?.report?.generatedAt || "").slice(0, 10) || "undated";
  return `proveit-${caseName}-${reportId}${scope}-${date}.${extension}`;
}

export function buildReportOutput(document, format) {
  if (format === "markdown") return { format, content: formatReportDocumentAsMarkdown(document), mimeType: "text/markdown;charset=utf-8", extension: "md", filename: getReportOutputFilename(document, format) };
  if (format === "json") return { format, content: formatReportDocumentAsJson(document), mimeType: "application/json;charset=utf-8", extension: "json", filename: getReportOutputFilename(document, format) };
  throw new Error(`Unsupported report output format: ${format}`);
}
