import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const watchWorkspace = readFileSync(new URL("./WatchWorkspace.jsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../../index.css", import.meta.url), "utf8");

test("Watch editor uses DialogShell with the standard accessible form boundary", () => {
  assert.match(watchWorkspace, /import DialogShell/);
  assert.match(watchWorkspace, /<DialogShell/);
  assert.match(watchWorkspace, /width="wide"/);
  assert.match(watchWorkspace, /dismissOnBackdrop=\{false\}/);
  assert.match(watchWorkspace, /initialFocusRef=\{titleRef\}/);
  assert.match(watchWorkspace, /className="proveit-watch-dialog"/);
  assert.match(css, /\.proveit-watch-dialog/);
});

test("Watch editor preserves a complete draft baseline and guards ordinary dismissal", () => {
  assert.match(watchWorkspace, /function watchDraftFingerprint/);
  assert.match(watchWorkspace, /initialFingerprintRef\.current !== watchDraftFingerprint\(form\)/);
  assert.match(watchWorkspace, /Discard unsaved watch item changes/);
  assert.match(watchWorkspace, /Keep editing/);
  assert.match(watchWorkspace, /Discard changes/);
  assert.match(watchWorkspace, /onRequestClose=\{requestClose\}/);
  assert.match(watchWorkspace, /key=\{editing\?\.id \|\| "new"\}/);
});

test("Watch editor preserves links, observations, and attachment references while waiting for confirmed saves", () => {
  assert.match(watchWorkspace, /linkedPartyIds=\{form\.linkedPartyIds\}/);
  assert.match(watchWorkspace, /linkedRecordIds\.includes\(record\.id\)/);
  assert.match(watchWorkspace, /set\("observations"/);
  assert.match(watchWorkspace, /form\.attachments\.length > 0/);
  assert.match(watchWorkspace, /const saved = await onSave\(normalizeWatchItem/);
  assert.match(watchWorkspace, /The watch item could not be saved/);
  assert.match(watchWorkspace, /const saved = await onUpdateCase/);
  assert.match(watchWorkspace, /if \(saved\) setEditing\(undefined\)/);
});

test("Watch editor preserves conversion and deletion callbacks outside the dialog migration", () => {
  assert.match(watchWorkspace, /cleanupDeletedRecordLinks/);
  assert.match(watchWorkspace, /watch-conversion/);
  assert.match(watchWorkspace, /status:"escalated"/);
});
