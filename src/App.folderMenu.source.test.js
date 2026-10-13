import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const app = readFileSync(new URL("./App.jsx", import.meta.url), "utf8");
const css = readFileSync(new URL("./index.css", import.meta.url), "utf8");

test("folder actions dismiss on outside pointer input and Escape, then restore trigger focus", () => {
  assert.match(app, /document\.addEventListener\("pointerdown", handlePointerDown\)/);
  assert.match(app, /event\.key !== "Escape"/);
  assert.match(app, /requestAnimationFrame\(\(\) => folderMenuTriggerRef\.current\?\.focus\(\)\)/);
});

test("folder actions use a labelled menu with keyboard navigation and isolated click handling", () => {
  assert.match(app, /role="menu"/);
  assert.match(app, /aria-label=\{`Actions for \$\{folder\.name\}`\}/);
  assert.match(app, /\["ArrowDown", "ArrowUp", "Home", "End"\]/);
  assert.match(app, /event\.stopPropagation\(\)/);
  assert.match(app, /z-\[60\]/);
  assert.match(app, /menu\.getBoundingClientRect\(\)\.bottom > window\.innerHeight - 8/);
  assert.match(app, /folderMenuPlacement === "above" \? "bottom-9" : "top-9"/);
  assert.match(app, /folderMenuId === folder\.id \? "relative z-20"/);
});

test("folder menu dark treatment keeps destructive and color controls legible", () => {
  assert.match(app, /Color for \$\{folder\.name\}/);
  assert.match(app, /folder-menu-delete/);
  assert.match(css, /case-folder-action-menu/);
  assert.match(css, /folder-menu-delete:hover/);
  assert.match(css, /#ffb7c5/);
});
