import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const app = readFileSync(new URL("./App.jsx", import.meta.url), "utf8");
const css = readFileSync(new URL("./index.css", import.meta.url), "utf8");

test("Storage Diagnostics remains an inline, read-only summary with the technical snapshot preserved", () => {
  assert.match(app, /proveit-storage-diagnostics mb-6/);
  assert.match(app, /Read-only browser storage snapshot\. This does not modify case data or browser storage\./);
  assert.match(app, /Technical storage snapshot/);
  assert.match(app, /JSON\.stringify\(storageDiagnostics, null, 2\)/);
  assert.match(css, /\.proveit-storage-diagnostics \{/);
});

test("Storage Diagnostics retains all existing refresh, loading, error, and storage data wiring", () => {
  assert.match(app, /onClick=\{handleStorageDiagnostics\}/);
  assert.match(app, /storageDiagnosticsLoading/);
  assert.match(app, /storageDiagnosticsError/);
  for (const location of ["recordCounts?.cases", "recordCounts?.evidence", "recordCounts?.images", "localStorage?.quickCaptureCount", "localStorage?.folderCount", "localStorage?.rescueSnapshotExists"]) {
    assert.match(app, new RegExp(location.replaceAll("?", "\\?").replaceAll(".", "\\.")));
  }
  assert.match(app, /lastBackupMeta\?\.exportType === "FULL_BACKUP_ALL"/);
  assert.match(app, /lastBackupMeta\.binaryData\?\.included/);
});

test("Storage Diagnostics status feedback uses accessible live semantics", () => {
  assert.match(app, /proveit-storage-diagnostics-status mt-4" role="status"/);
  assert.match(app, /proveit-storage-diagnostics-error mt-4" role="alert"/);
  assert.match(app, /aria-label="Refresh Storage Diagnostics"/);
});
