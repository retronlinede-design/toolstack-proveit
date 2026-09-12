import { getCaseRevision, INITIAL_CASE_REVISION } from "../domain/caseRevision.js";
import { buildCaseReasoningExportV3Payload } from "./reasoningExportV3.js";

export const AI_WORKSPACE_FORMAT = "proveit-ai-workspace";
export const AI_WORKSPACE_VERSION = "1.0";
export const AI_WORKSPACE_CURRENT_CASE_FILENAME = "CURRENT_CASE.json";
export const AI_WORKSPACE_MANIFEST_FILENAME = "WORKSPACE_MANIFEST.json";

function caseIdentity(caseItem) {
  if (!caseItem?.id) throw new Error("caseItem.id is required for an AI Workspace export");
  return String(caseItem.id);
}

export function buildAiWorkspaceManifest(caseItem, options = {}) {
  const exportedAt = options.exportedAt || new Date().toISOString();
  return {
    workspaceFormat: AI_WORKSPACE_FORMAT,
    workspaceVersion: AI_WORKSPACE_VERSION,
    caseId: caseIdentity(caseItem),
    baseRevision: getCaseRevision(caseItem) || INITIAL_CASE_REVISION,
    exportedAt,
    snapshotFile: AI_WORKSPACE_CURRENT_CASE_FILENAME,
    snapshotPurpose: "ai_reasoning_context",
    importableAsBackup: false,
    includesBinaryData: false,
  };
}

export function buildAiWorkspaceCurrentCase(caseItem, options = {}) {
  const manifest = buildAiWorkspaceManifest(caseItem, options);
  return {
    ...manifest,
    projectionContractVersion: "reasoning-export-3.0",
    projection: buildCaseReasoningExportV3Payload(caseItem, { exportedAt: manifest.exportedAt }),
  };
}
