import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const app = readFileSync(new URL("./App.jsx", import.meta.url), "utf8");

test("Manage Folders retains its existing create, rename, colour, description, and delete wiring", () => {
  assert.match(app, /onClick=\{createFolder\}/);
  assert.match(app, /event\.key === "Enter"\) createFolder\(\)/);
  assert.match(app, /updateFolder\(folder\.id, \{ name: event\.target\.value \}\)/);
  assert.match(app, /updateFolder\(folder\.id, \{ color: event\.target\.value \}\)/);
  assert.match(app, /updateFolder\(folder\.id, \{ description: event\.target\.value \}\)/);
  assert.match(app, /deleteFolder\(folder\.id\)/);
  assert.match(app, /window\.confirm\(`Delete folder/);
});

test("Manage Folders uses the shared dialog dismissal and initial-focus contract", () => {
  assert.match(app, /const folderNameInputRef = useRef\(null\)/);
  assert.match(app, /ref=\{folderNameInputRef\}/);
  assert.match(app, /onRequestClose=\{\(\) => setFolderModalOpen\(false\)\}/);
  assert.match(app, /dismissOnBackdrop=\{false\}/);
});
