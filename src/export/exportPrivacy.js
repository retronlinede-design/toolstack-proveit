export const EXPORT_PRIVACY_PROFILES = {
  FULL_BACKUP: {
    exportType: "FULL_BACKUP",
    label: "Full Backup",
    includesEvidenceFiles: true,
    includesPrivateNotes: true,
    includesPinData: false,
  },
  SANITIZED_EXPORT: {
    exportType: "SANITIZED_EXPORT",
    label: "Sanitized Export",
    includesEvidenceFiles: false,
    includesPrivateNotes: true,
    includesPinData: false,
  },
  GPT_AUDIT_PACK: {
    exportType: "GPT_AUDIT_PACK",
    label: "GPT Audit Pack",
    includesEvidenceFiles: false,
    includesPrivateNotes: true,
    includesPinData: false,
  },
  SPECIALIST_HANDOFF: {
    exportType: "SPECIALIST_HANDOFF",
    label: "Specialist Handoff",
    includesEvidenceFiles: false,
    includesPrivateNotes: true,
    includesPinData: false,
  },
  REPORT_EXPORT: {
    exportType: "REPORT_EXPORT",
    label: "Report Export",
    includesEvidenceFiles: false,
    includesPrivateNotes: true,
    includesPinData: false,
  },
  EVIDENCE_FILE_EXPORT: {
    exportType: "EVIDENCE_FILE_EXPORT",
    label: "Evidence/File Export",
    includesEvidenceFiles: true,
    includesPrivateNotes: false,
    includesPinData: false,
  },
};

export function buildExportPrivacyMetadata(profile, overrides = {}) {
  const selectedProfile = profile || {};
  const exportType = overrides.exportType || selectedProfile.exportType || "UNKNOWN_EXPORT";
  return {
    exportType,
    label: overrides.label || selectedProfile.label || exportType,
    createdAt: overrides.createdAt || new Date().toISOString(),
    includesEvidenceFiles: overrides.includesEvidenceFiles ?? selectedProfile.includesEvidenceFiles ?? false,
    includesPrivateNotes: overrides.includesPrivateNotes ?? selectedProfile.includesPrivateNotes ?? false,
    includesPinData: false,
  };
}

export function getExportPrivacyWarning(profile, overrides = {}) {
  const metadata = buildExportPrivacyMetadata(profile, overrides);
  const includes = [
    metadata.includesEvidenceFiles ? "evidence files or attachment payloads" : "no evidence file payloads",
    metadata.includesPrivateNotes ? "case text, notes, or record summaries" : "no private notes",
    "no plaintext PIN values",
  ];

  return `${metadata.label} may contain sensitive case data: ${includes.join("; ")}. Store it securely and share it only with trusted recipients. Continue?`;
}
