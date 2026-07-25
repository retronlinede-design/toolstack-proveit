import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { transformWithOxc } from "vite";

const sourceUrl = new URL("./RecordBadge.jsx", import.meta.url);
const source = await readFile(sourceUrl, "utf8");
const transformed = await transformWithOxc(source, sourceUrl.pathname);
const jsxRuntimeUrl = import.meta.resolve("react/jsx-runtime");
const importableCode = transformed.code.replaceAll('from "react/jsx-runtime"', `from "${jsxRuntimeUrl}"`);
const componentModule = await import(`data:text/javascript;base64,${Buffer.from(importableCode).toString("base64")}`);
const { default: RecordBadge, DEFAULT_VARIANT, VARIANT_CLASSES } = componentModule;

const supportedVariants = [
  "type",
  "status-neutral",
  "status-positive",
  "status-warning",
  "status-critical",
  "verification-verified",
  "verification-partial",
  "verification-unverified",
  "priority-low",
  "priority-medium",
  "priority-high",
  "priority-critical",
  "milestone",
  "new",
  "restricted",
];

const renderBadge = (props, children) => renderToStaticMarkup(React.createElement(RecordBadge, props, children));

test("RecordBadge exposes and renders every supported semantic variant", () => {
  assert.deepEqual(Object.keys(VARIANT_CLASSES), supportedVariants);
  for (const variant of supportedVariants) {
    const html = renderBadge({ variant }, variant);
    assert.match(html, new RegExp(`data-record-badge-variant="${variant}"`));
    assert.match(html, new RegExp(`>${variant}</span>$`));
  }
});

test("RecordBadge renders children, a leading icon, and an accessible label", () => {
  const icon = React.createElement("svg", { "data-testid": "badge-icon" });
  const html = renderBadge({ leading: icon, accessibleLabel: "Verified evidence" }, "Verified");

  assert.match(html, /aria-label="Verified evidence"/);
  assert.match(html, /data-testid="badge-icon"/);
  assert.match(html, />Verified<\/span>$/);
});

test("RecordBadge preserves custom classes and standard span attributes", () => {
  const html = renderBadge({
    className: "custom-badge",
    id: "badge-id",
    title: "Badge title",
    "data-context": "record",
  }, "Active");

  assert.match(html, /class="[^"]*custom-badge[^"]*"/);
  assert.match(html, /id="badge-id"/);
  assert.match(html, /title="Badge title"/);
  assert.match(html, /data-context="record"/);
});

test("RecordBadge defaults and unknown variants fall back to status-neutral", () => {
  const defaultHtml = renderBadge({}, "Default");
  const unknownHtml = renderBadge({ variant: "not-a-variant" }, "Unknown");

  assert.equal(DEFAULT_VARIANT, "status-neutral");
  assert.match(defaultHtml, /data-record-badge-variant="status-neutral"/);
  assert.match(unknownHtml, /data-record-badge-variant="status-neutral"/);
  assert.match(unknownHtml, />Unknown<\/span>$/);
});
