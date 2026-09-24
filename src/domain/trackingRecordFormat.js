export const DEFAULT_TRACKING_RECORD_TABLE_TEXT = `| Period/Date | Expected | Actual | Difference | Unit | Status | Notes |
|-------------|----------|--------|------------|------|--------|-------|`;

function getTrackingRecordSection(text = "", startMarker, endMarker = null) {
  if (!text || !startMarker) return "";
  const start = text.indexOf(startMarker);
  if (start === -1) return "";
  const rest = text.slice(start + startMarker.length);
  if (!endMarker) return rest.trim();
  const end = rest.indexOf(endMarker);
  return end === -1 ? rest.trim() : rest.slice(0, end).trim();
}

function getTrackingRecordMetaValue(text = "", key = "") {
  const metaText = getTrackingRecordSection(text, "meta:", "--- TABLE ---");
  const line = metaText
    .split("\n")
    .map((item) => item.trim())
    .find((item) => item.toLowerCase().startsWith(`${key.toLowerCase()}:`));
  return line ? line.slice(line.indexOf(":") + 1).trim() : "";
}

export function getTrackingRecordTableText(text = "") {
  return getTrackingRecordSection(text, "--- TABLE ---", "--- SUMMARY (GPT READY) ---");
}

export function buildTrackingRecordText({
  metaType = "custom",
  purpose = "",
  period = "",
  status = "",
  tableText = "",
  summary = "",
  fileLinks = "",
  notes = "",
} = {}) {
  return `[TRACK RECORD]

meta:
type: ${metaType}
subject: ${purpose}
period: ${period}
status: ${status}

--- TABLE ---

${tableText || DEFAULT_TRACKING_RECORD_TABLE_TEXT}

--- SUMMARY (GPT READY) ---

${summary || ""}

--- FILE LINKS ---

${fileLinks || ""}

--- NOTES ---

${notes || ""}
`;
}

/** Preserves a Tracking Record Document's non-text fields while replacing only its table section. */
export function replaceTrackingRecordTableText(document = {}, tableText = "") {
  const textContent = typeof document.textContent === "string" ? document.textContent : "";
  return {
    ...document,
    textContent: buildTrackingRecordText({
      metaType: getTrackingRecordMetaValue(textContent, "type") || "custom",
      purpose: getTrackingRecordMetaValue(textContent, "subject"),
      period: getTrackingRecordMetaValue(textContent, "period"),
      status: getTrackingRecordMetaValue(textContent, "status"),
      tableText,
      summary: getTrackingRecordSection(textContent, "--- SUMMARY (GPT READY) ---", "--- FILE LINKS ---"),
      fileLinks: getTrackingRecordSection(textContent, "--- FILE LINKS ---", "--- NOTES ---"),
      notes: getTrackingRecordSection(textContent, "--- NOTES ---"),
    }),
  };
}