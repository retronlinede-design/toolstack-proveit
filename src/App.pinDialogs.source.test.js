import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const appSource = readFileSync(new URL("./App.jsx", import.meta.url), "utf8");
const css = readFileSync(new URL("./index.css", import.meta.url), "utf8");

test("case PIN management uses the shared dialog without enabling backdrop dismissal", () => {
  assert.match(appSource, /pinManagerState\.open && pinManagerCase/);
  assert.match(appSource, /<DialogShell/);
  assert.match(appSource, /className="proveit-case-pin-dialog"/);
  assert.match(appSource, /dismissOnBackdrop=\{false\}/);
  assert.match(appSource, /initialFocusRef=\{pinManagerInputRef\}/);
  assert.match(appSource, /form="case-pin-manager-form"/);
  assert.match(appSource, /aria-pressed=\{pinManagerState\.mode === "change"\}/);
  assert.match(appSource, /aria-pressed=\{pinManagerState\.mode === "remove"\}/);
  assert.match(appSource, /role="alert"/);
  assert.match(css, /\.proveit-case-pin-dialog/);
});

test("app and case unlock remain full-screen security flows with masked PIN inputs", () => {
  assert.match(appSource, /if \(appLocked\)/);
  assert.match(appSource, /proveit-app-lock-screen/);
  assert.match(appSource, /selectedCaseRequiresPin/);
  assert.match(appSource, /proveit-case-unlock-panel/);
  assert.match(appSource, /type="password"/);
  assert.match(appSource, /handleUnlockApp/);
  assert.match(appSource, /handleUnlockSelectedCase/);
  assert.match(appSource, /Wrong PIN\. Check the digits and try again\./);
  assert.match(css, /\.proveit-app-lock-screen/);
  assert.match(css, /\.proveit-case-unlock-panel/);
});
