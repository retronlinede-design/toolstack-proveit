import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { transformWithOxc } from "vite";

const sourceUrl = new URL("./RecordActions.jsx", import.meta.url);
const source = await readFile(sourceUrl, "utf8");
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
