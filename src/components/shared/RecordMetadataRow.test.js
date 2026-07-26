import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { transformWithOxc } from "vite";

const sourceUrl = new URL("./RecordMetadataRow.jsx", import.meta.url);
const source = await readFile(sourceUrl, "utf8");
const transformed = await transformWithOxc(source, sourceUrl.pathname);
const jsxRuntimeUrl = import.meta.resolve("react/jsx-runtime");
const code = transformed.code.replaceAll('from "react/jsx-runtime"', `from "${jsxRuntimeUrl}"`);
const { default: RecordMetadataRow } = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
const render = (props) => renderToStaticMarkup(React.createElement(RecordMetadataRow, props));

test("renders one item with label and value", () => {
  const html = render({ items: [{ key: "review", label: "Review", value: "14 August 2026" }] });
  assert.match(html, /Review:/);
  assert.match(html, /14 August 2026/);
});

test("renders multiple items in their supplied order", () => {
  const html = render({ items: [{ key: "first", value: "First" }, { key: "second", value: "Second" }, { key: "third", value: "Third" }] });
  assert.ok(html.indexOf("First") < html.indexOf("Second"));
  assert.ok(html.indexOf("Second") < html.indexOf("Third"));
});

test("suppresses hidden null empty and whitespace values while retaining zero and false", () => {
  const html = render({ items: [
    { key: "hidden", value: "Hidden", hidden: true }, { key: "null", value: null },
    { key: "empty", value: "" }, { key: "space", value: "   " },
    { key: "zero", value: 0 }, { key: "false", value: false },
  ] });
  assert.doesNotMatch(html, /Hidden/);
  assert.match(html, />0</);
  assert.match(html, />false</);
});

test("renders icons decoratively and preserves custom rendered links", () => {
  const icon = React.createElement("svg", { "data-testid": "calendar" });
  const link = React.createElement("a", { href: "/party/1" }, "Party link");
  const html = render({ items: [{ key: "date", value: "2026-08-14", icon }, { key: "party", render: link }] });
  assert.match(html, /aria-hidden="true"/);
  assert.match(html, /data-testid="calendar"/);
  assert.match(html, /<a href="\/party\/1">Party link<\/a>/);
});

test("preserves custom classes and includes wrapping and explicit dark-mode styles", () => {
  const html = render({ className: "mt-3 custom-row", items: [{ key: "long", label: "Owner", value: "A very long metadata value", className: "custom-item", valueClassName: "custom-value" }] });
  assert.match(html, /custom-row/);
  assert.match(html, /custom-item/);
  assert.match(html, /custom-value/);
  assert.match(html, /flex-wrap/);
  assert.match(html, /overflow-wrap:anywhere/);
  assert.match(html, /dark:text-neutral-300/);
  assert.match(html, /dark:text-neutral-100/);
});

test("returns no row when every item is empty", () => {
  assert.equal(render({ items: [{ key: "empty", value: undefined }] }), "");
});
