import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { transformWithOxc } from "vite";

const sourceUrl = new URL("./RecordActions.jsx", import.meta.url);
const source = await readFile(sourceUrl, "utf8");
const stylesheet = await readFile(new URL("../../index.css", import.meta.url), "utf8");
const transformed = await transformWithOxc(source, sourceUrl.pathname);
const jsxRuntimeUrl = import.meta.resolve("react/jsx-runtime");
const importableCode = transformed.code.replaceAll('from "react/jsx-runtime"', `from "${jsxRuntimeUrl}"`);
const componentModule = await import(`data:text/javascript;base64,${Buffer.from(importableCode).toString("base64")}`);
const { default: RecordActions, DEFAULT_VARIANT, VARIANT_CLASSES } = componentModule;

const variants = ["primary", "secondary", "neutral", "danger"];
const makeAction = (overrides = {}) => ({ key: "edit", label: "Edit", onClick() {}, ...overrides });
const renderActions = (props) => renderToStaticMarkup(React.createElement(RecordActions, props));

test("RecordActions renders all supported variants and falls back safely", () => {
  assert.deepEqual(Object.keys(VARIANT_CLASSES), variants);
  for (const variant of variants) {
    const html = renderActions({ actions: [makeAction({ key: variant, variant })] });
    assert.match(html, new RegExp(`data-record-action-variant="${variant}"`));
  }

  assert.equal(DEFAULT_VARIANT, "neutral");
  const fallbackHtml = renderActions({ actions: [makeAction({ variant: "unknown" })] });
  assert.match(fallbackHtml, /data-record-action-variant="neutral"/);
});

test("RecordActions uses the shared navy, teal, and destructive action palette", () => {
  assert.match(VARIANT_CLASSES.primary, /border-\[#0f766e\].*bg-\[#0f766e\].*text-white.*hover:bg-\[#115e59\]/);
  assert.match(VARIANT_CLASSES.secondary, /border-\[#475569\].*bg-\[#172554\].*text-white.*hover:bg-\[#1e3a5f\]/);
  assert.match(VARIANT_CLASSES.danger, /border-\[#7f1d1d\].*bg-\[#7f1d1d\].*text-white.*hover:bg-\[#991b1b\]/);
  assert.match(source, /focus-visible:ring-\[#2dd4bf\]/);
  assert.doesNotMatch(stylesheet, /case-file-incident-actions \[data-record-action-variant="(?:primary|secondary)"\]/);
});

test("RecordActions renders icons, labels, title, aria-label, and disabled state", () => {
  const icon = React.createElement("svg", { "data-testid": "action-icon" });
  const html = renderActions({ actions: [makeAction({
    label: "A very long action label",
    icon,
    disabled: true,
    title: "Edit this record",
    "aria-label": "Edit record",
  })] });

  assert.match(html, /data-testid="action-icon"/);
  assert.match(html, />A very long action label<\/span>/);
  assert.match(html, /disabled=""/);
  assert.match(html, /title="Edit this record"/);
  assert.match(html, /aria-label="Edit record"/);
});

test("RecordActions omits hidden actions and preserves a custom container class", () => {
  const html = renderActions({
    className: "custom-actions",
    actions: [makeAction({ hidden: true }), makeAction({ key: "delete", label: "Delete" })],
  });

  assert.match(html, /class="custom-actions"/);
  assert.doesNotMatch(html, />Edit<\/span>/);
  assert.match(html, />Delete<\/span>/);
});

test("RecordActions forwards clicks unchanged and relies on native keyboard activation", () => {
  let clicks = 0;
  const onClick = () => { clicks += 1; };
  const tree = RecordActions({ actions: [makeAction({ onClick })] });
  const button = tree.props.children[0];

  assert.equal(button.props.onClick, onClick);
  button.props.onClick();
  assert.equal(clicks, 1);
  assert.equal(button.props.type, "button");
  assert.equal(button.props.onKeyDown, undefined);
});
