import test from "node:test";
import assert from "node:assert/strict";

import {
  buildExportPrivacyMetadata,
  EXPORT_PRIVACY_PROFILES,
  getExportPrivacyWarning,
} from "./exportPrivacy.js";

test("buildExportPrivacyMetadata always reports no PIN data", () => {
  const metadata = buildExportPrivacyMetadata(EXPORT_PRIVACY_PROFILES.FULL_BACKUP, {
    exportType: "FULL_BACKUP_ALL",
    createdAt: "2026-07-04T12:00:00.000Z",
  });

  assert.deepEqual(metadata, {
    exportType: "FULL_BACKUP_ALL",
    label: "Full Backup",
    createdAt: "2026-07-04T12:00:00.000Z",
    includesEvidenceFiles: true,
    includesPrivateNotes: true,
    includesPinData: false,
  });
});

test("getExportPrivacyWarning distinguishes sanitized exports", () => {
  const warning = getExportPrivacyWarning(EXPORT_PRIVACY_PROFILES.SANITIZED_EXPORT, {
    exportType: "CASE_REASONING_EXPORT",
  });

  assert.match(warning, /Sanitized Export/);
  assert.match(warning, /no evidence file payloads/);
  assert.match(warning, /case text, notes, or record summaries/);
  assert.match(warning, /no plaintext PIN values/);
});
