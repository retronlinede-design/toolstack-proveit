export const CLIENT_REPORT_PROMPT_REVISION = "client-report-prompt-v2";
const REQUIRED_HEADINGS = ["REPORT_TITLE", "YOUR_SITUATION", "CURRENT_POSITION"];
const UUID = /\b(?:issue_)?[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i;
function issue(code, message, severity = "error") { return { code, message, severity }; }
export function getClientNarrativeRevisionState(narrativeSourceRevision, currentSourceRevision) {
  if (!narrativeSourceRevision) return "unknown";
  return narrativeSourceRevision === currentSourceRevision ? "current" : "stale";
}
export function validateClientReportNarrative(input, { sourceRevision = "", currentSourceRevision = "" } = {}) {
  const text = typeof input === "string" ? input.trim() : ""; const errors = []; const warnings = [];
  if (!text) errors.push(issue("EMPTY_OUTPUT", "Paste the generated Client Report output before validating it."));
  if (/Create a client-facing report|ProveIt Report Format v1:|\[REPORT INSTRUCTIONS\]/i.test(text)) errors.push(issue("PROMPT_PASTED", "This appears to be the prompt or GPT instructions, not the generated report output."));
  if ((text.startsWith("{") && text.endsWith("}")) || (text.startsWith("[") && text.endsWith("]"))) errors.push(issue("TECHNICAL_JSON", "Technical JSON was pasted into the prose field. Paste the formatted Client Report response instead."));
  if (/\bTODO\b|<[^>]+>|\{\{[^}]+\}\}|\[INSERT[^]]*\]/i.test(text)) errors.push(issue("UNRESOLVED_PLACEHOLDER", "The draft contains TODO or unresolved template placeholder text."));
  if (UUID.test(text)) errors.push(issue("BARE_INTERNAL_ID", "The draft contains a bare internal UUID. Replace it with a readable Issue or record reference."));
  if (/system message|developer instruction|ignore (?:all |the )?previous|GPT delta|operations\.patch/i.test(text)) errors.push(issue("RAW_AI_INSTRUCTIONS", "The draft contains raw AI or update instructions that must not appear in a Client Report."));
  if (text && text.length < 180) warnings.push(issue("POSSIBLY_TRUNCATED", "The generated response is unusually short and may be truncated.", "warning"));
  for (const heading of REQUIRED_HEADINGS) if (!new RegExp(`^#\\s+${heading}\\s*$`, "im").test(text)) errors.push(issue("MISSING_REQUIRED_HEADING", `Required heading # ${heading} is missing.`));
  const revisionState = getClientNarrativeRevisionState(sourceRevision, currentSourceRevision);
  if (revisionState === "stale") warnings.push(issue("STALE_SOURCE_REVISION", "This Client Report draft was generated from an older case revision. Regenerate or review it carefully before sharing.", "warning"));
  if (revisionState === "unknown" && text) warnings.push(issue("UNKNOWN_SOURCE_REVISION", "This legacy draft has no recorded source revision. Its provenance cannot be confirmed.", "warning"));
  return { valid: errors.length === 0, errors, warnings, revisionState };
}
