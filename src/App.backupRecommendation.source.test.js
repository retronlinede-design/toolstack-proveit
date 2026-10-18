import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const appSource = readFileSync(new URL("./App.jsx", import.meta.url), "utf8");

test("backup recommendation preserves resolver-backed continuation decisions", () => {
  assert.match(appSource, /const closeRiskyActionGuard = \(shouldContinue\) =>/);
  assert.match(appSource, /if \(resolve\) resolve\(shouldContinue\)/);
  assert.match(appSource, /const requireRecentFullBackup = \(\) =>/);
  assert.match(appSource, /riskyActionGuardResolverRef\.current = resolve/);
});

test("backup recommendation preserves its three existing actions and cancellation path", () => {
  assert.match(appSource, /onClick=\{handleRiskyActionDownloadBackup\}/);
  assert.match(appSource, /onClick=\{\(\) => closeRiskyActionGuard\(true\)\}/);
  assert.match(appSource, /onClick=\{\(\) => closeRiskyActionGuard\(false\)\}/);
  assert.match(appSource, /onRequestClose=\{\(\) => closeRiskyActionGuard\(false\)\}/);
  assert.match(appSource, />\s*Download Full Backup\s*</);
  assert.match(appSource, />\s*Continue Anyway\s*</);
  assert.match(appSource, />\s*Cancel\s*</);
});
