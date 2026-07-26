import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { transformWithOxc } from "vite";

const sourceUrl = new URL("./RecordCardShell.jsx", import.meta.url);
const source = await readFile(sourceUrl, "utf8");
const transformed = await transformWithOxc(source, sourceUrl.pathname);
const runtime = import.meta.resolve("react/jsx-runtime");
const code = transformed.code.replaceAll('from "react/jsx-runtime"', `from "${runtime}"`);
const { default: RecordCardShell, DEFAULT_VARIANT, VARIANT_CLASSES } = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
const render = (props, children) => renderToStaticMarkup(React.createElement(RecordCardShell, props, children));

test("renders semantic article title subtitle and leading content", () => {
  const html = render({ title: "Long record title", subtitle: "Subtitle", leading: React.createElement("span", null, "Leading") });
  assert.match(html, /^<article/);
  assert.match(html, /<h3[^>]*>Long record title<\/h3>/);
  assert.match(html, /Subtitle/);
  assert.match(html, /Leading/);
  assert.match(html, /break-words/);
});

test("supports heading level four for existing card hierarchy", () => {
  assert.match(render({ title: "Document", headingLevel: 4 }), /<h4[^>]*>Document<\/h4>/);
});

test("renders badges actions metadata links children and footer in order", () => {
  const html = render({
    title: "Record",
    badges: React.createElement("span", null, "Badges"),
    actions: React.createElement("button", null, "Actions"),
    metadata: React.createElement("div", null, "Metadata"),
    links: React.createElement("div", null, "Links"),
    footer: React.createElement("div", null, "Footer"),
  }, React.createElement("div", null, "Content"));
  for (const value of ["Badges", "Actions", "Metadata", "Links", "Content", "Footer"]) assert.match(html, new RegExp(value));
  assert.ok(html.indexOf("Badges") < html.indexOf("Actions"));
  assert.ok(html.indexOf("Actions") < html.indexOf("Metadata"));
  assert.ok(html.indexOf("Metadata") < html.indexOf("Links"));
  assert.ok(html.indexOf("Links") < html.indexOf("Content"));
  assert.ok(html.indexOf("Content") < html.indexOf("Footer"));
});

test("does not render empty optional-region wrappers", () => {
  const html = render({ title: "Minimal" });
  assert.doesNotMatch(html, /<footer/);
  assert.equal((html.match(/mt-3/g) || []).length, 0);
  assert.doesNotMatch(html, /border-t/);
});

test("preserves custom className and standard article attributes", () => {
  const html = render({ title: "Record", className: "custom-shell", id: "record-1", "aria-label": "Record card" });
  assert.match(html, /custom-shell/);
  assert.match(html, /id="record-1"/);
  assert.match(html, /aria-label="Record card"/);
});

test("selected state includes ring shape indicator and accessible text", () => {
  const selected = render({ title: "Selected", selected: true });
  assert.match(selected, /data-selected="true"/);
  assert.match(selected, /ring-2/);
  assert.match(selected, /inset-y-3/);
  assert.match(selected, /Selected record/);
  const unselected = render({ title: "Unselected" });
  assert.match(unselected, /data-selected="false"/);
  assert.doesNotMatch(unselected, /Selected record/);
});

test("central shell includes hover responsive and explicit dark-mode styling", () => {
  const html = render({ title: "Styled" });
  assert.match(html, /hover:border-neutral-300/);
  assert.match(html, /hover:shadow-md/);
  assert.match(html, /dark:bg-neutral-900/);
  assert.match(html, /dark:border-neutral-700/);
  assert.match(html, /sm:flex-row/);
  assert.match(html, /flex-col/);
  assert.doesNotMatch(html, /fixed|overflow-x-auto/);
});

test("expanded content receives a dark-compatible divider", () => {
  const html = render({ title: "Expanded", expanded: true }, React.createElement("p", null, "Details"));
  assert.match(html, /border-t border-neutral-200 pt-4 dark:border-neutral-700/);
});

test("supports incident milestone and new surfaces with safe fallback", () => {
  assert.deepEqual(Object.keys(VARIANT_CLASSES), ["default", "milestone", "new"]);
  assert.equal(DEFAULT_VARIANT, "default");
  assert.match(render({ title: "Milestone", variant: "milestone" }), /data-record-card-variant="milestone"/);
  assert.match(render({ title: "New", variant: "new" }), /data-record-card-variant="new"/);
  assert.match(render({ title: "Fallback", variant: "unknown" }), /data-record-card-variant="default"/);
});
