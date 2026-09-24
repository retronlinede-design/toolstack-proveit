export const DEFAULT_TRACKING_RECORD_TABLE_TEXT = `| Period/Date | Expected | Actual | Difference | Unit | Status | Notes |
|-------------|----------|--------|------------|------|--------|-------|`;

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