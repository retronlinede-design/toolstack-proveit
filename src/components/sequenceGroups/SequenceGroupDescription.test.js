import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { transformWithOxc } from "vite";

const sourceUrl = new URL("./SequenceGroupDescription.jsx", import.meta.url);
const source = await readFile(sourceUrl, "utf8");
const transformed = await transformWithOxc(source, sourceUrl.pathname);
const jsxRuntimeUrl = import.meta.resolve("react/jsx-runtime");
const reactUrl = import.meta.resolve("react");
const importableCode = transformed.code
  .replaceAll('from "react/jsx-runtime"', `from "${jsxRuntimeUrl}"`)
  .replaceAll('from "react"', `from "${reactUrl}"`);
const module = await import(`data:text/javascript;base64,${Buffer.from(importableCode).toString("base64")}`);

test("blank sequence group descriptions render a neutral empty value", () => {
  const html = renderToStaticMarkup(React.createElement(module.default, { description: "" }));
  assert.match(html, /No description added/);
});

test("long descriptions render a bounded preview and accessible disclosure", () => {
  const html = renderToStaticMarkup(React.createElement(module.default, { description: "A".repeat(400) }));
  assert.match(html, /Show more/);
  assert.match(html, /aria-expanded="false"/);
  assert.match(html, /aria-controls=/);
  assert.equal(html.includes("A".repeat(400)), false);
});
