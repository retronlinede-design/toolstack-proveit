import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { transformWithOxc } from "vite";

const sourceUrl = new URL("./RecordLinksRow.jsx", import.meta.url);
const source = await readFile(sourceUrl, "utf8");
const transformed = await transformWithOxc(source, sourceUrl.pathname);
const runtime = import.meta.resolve("react/jsx-runtime");
const code = transformed.code.replaceAll('from "react/jsx-runtime"', `from "${runtime}"`);
const module = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
const { default: RecordLinksRow, DEFAULT_VARIANT, VARIANT_CLASSES } = module;
const render = (props) => renderToStaticMarkup(React.createElement(RecordLinksRow, props));

test("renders one or multiple groups and preserves group and item order", () => {
  const html = render({ groups: [
    { key: "records", label: "Linked records", items: [{ key: "a", label: "First" }, { key: "b", label: "Second" }] },
    { key: "files", label: "Attachments", items: [{ key: "c", label: "Third" }] },
  ] });
  assert.ok(html.indexOf("Linked records") < html.indexOf("Attachments"));
  assert.ok(html.indexOf("First") < html.indexOf("Second"));
  assert.ok(html.indexOf("Second") < html.indexOf("Third"));
});

test("hides hidden groups and items and hides empty groups by default", () => {
  const html = render({ groups: [
    { key: "hidden", hidden: true, items: [{ key: "x", label: "Hidden group" }] },
    { key: "empty", items: [] },
    { key: "visible", items: [{ key: "hidden-item", label: "Hidden item", hidden: true }, { key: "shown", label: "Shown" }] },
  ] });
  assert.doesNotMatch(html, /Hidden group|Hidden item/);
  assert.doesNotMatch(html, /data-record-links-group="empty"/);
  assert.match(html, /Shown/);
});

test("renders an empty label only when supplied", () => {
  const html = render({ groups: [{ key: "empty", label: "Records", items: [], emptyLabel: "No linked records" }] });
  assert.match(html, /No linked records/);
});

test("preserves native link button and non-interactive semantics", () => {
  const html = render({ groups: [{ key: "mixed", items: [
    { key: "link", label: "Link", href: "/records/1" },
    { key: "button", label: "Button", onClick() {} },
    { key: "text", label: "Text" },
  ] }] });
  assert.match(html, /<a[^>]+href="\/records\/1"/);
  assert.match(html, /<button[^>]+type="button"/);
  assert.match(html, /<span[^>]+data-record-link-variant="neutral"/);
});

test("forwards clicks unchanged and relies on native keyboard activation", () => {
  let clicks = 0;
  const onClick = () => { clicks += 1; };
  const tree = RecordLinksRow({ groups: [{ key: "records", items: [{ key: "record", label: "Record", onClick }] }] });
  const groupElement = tree.props.children[0];
  const groupTree = groupElement.type(groupElement.props);
  const itemElement = groupTree.props.children[1].props.children[0];
  const button = itemElement.type(itemElement.props);
  assert.equal(button.props.onClick, onClick);
  assert.equal(button.props.onKeyDown, undefined);
  button.props.onClick();
  assert.equal(clicks, 1);
});

test("disabled items cannot activate", () => {
  const html = render({ groups: [{ key: "disabled", items: [{ key: "button", label: "Disabled", onClick() {}, disabled: true }] }] });
  assert.match(html, /disabled=""/);
  assert.match(html, /disabled:pointer-events-none/);
});

test("supports every variant, missing state, count, and safe fallback", () => {
  assert.deepEqual(Object.keys(VARIANT_CLASSES), ["neutral", "linked", "attachment", "party", "sequence", "warning", "missing"]);
  assert.equal(DEFAULT_VARIANT, "neutral");
  const items = Object.keys(VARIANT_CLASSES).map((variant) => ({ key: variant, label: variant, variant }));
  items.push({ key: "count", label: "Linked records", count: 4 });
  items.push({ key: "unknown", label: "Unknown", variant: "other" });
  const html = render({ groups: [{ key: "variants", items }] });
  for (const variant of Object.keys(VARIANT_CLASSES)) assert.match(html, new RegExp(`data-record-link-variant="${variant}"`));
  assert.match(html, /Linked records/);
  assert.match(html, />4</);
  assert.match(html, /Unknown/);
});

test("supports custom-rendered groups and items", () => {
  const html = render({ groups: [
    { key: "custom-group", render: React.createElement("aside", null, "Custom group") },
    { key: "custom-item", items: [{ key: "custom", render: React.createElement("strong", null, "Custom item") }] },
  ] });
  assert.match(html, /<aside>Custom group<\/aside>/);
  assert.match(html, /<strong>Custom item<\/strong>/);
});

test("applies custom classes, long-label wrapping, dark styles, and decorative icons", () => {
  const icon = React.createElement("svg", { "data-testid": "link-icon" });
  const html = render({ className: "custom-row", groups: [{ key: "links", icon, className: "custom-group", itemClassName: "custom-item", items: [{ key: "long", label: "A very long relationship title", icon, className: "custom-link", variant: "linked" }] }] });
  assert.match(html, /custom-row|custom-group|custom-item|custom-link/);
  assert.match(html, /overflow-wrap:anywhere/);
  assert.match(html, /dark:border-sky-800/);
  assert.match(html, /focus-visible:ring/);
  assert.match(html, /aria-hidden="true"/);
});
