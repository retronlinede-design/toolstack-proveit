import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";
import { transformWithOxc } from "vite";

const url = new URL("./AiBriefPanel.jsx", import.meta.url);
const transformed = await transformWithOxc(await readFile(url, "utf8"), url.pathname);
const code = transformed.code.replaceAll('from "react/jsx-runtime"', `from "${import.meta.resolve("react/jsx-runtime")}"`);
const { default: AiBriefPanel } = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);

const brief = {
  requestedReportFamily: "investigation",
  scope: { label: "ISS-001 — Synthetic Issue" },
  source: { caseRevision: "2026-10-26T10:00:00.000Z", sourceFingerprint: "fnv1a-test" },
  technicalSources: [{ id: "incidentSchedule", label: "Incident Schedule", included: true }, { id: "ledger", label: "Ledger Schedule", included: false }],
  recordReferences: [{ recordId: "inc-1" }],
  diagnostics: { unresolvedReferences: [{ targetId: "missing" }] },
};

test("renders the exact prepared package summary, inspection, and export actions", () => {
  const html = renderToStaticMarkup(React.createElement(AiBriefPanel, { brief, freshness: "current", feedback: "Prepared locally.", onCopy() {}, onDownload() {} }));
  for (const text of ["AI Brief prepared", "ISS-001 — Synthetic Issue", "Source: Current", "Source revision", "Source fingerprint", "Incident Schedule", "Copy AI Brief JSON", "Download AI Brief JSON", "Inspect AI Brief JSON", "Attachment binaries and data URLs are excluded", "Prepared locally."]) assert.match(html, new RegExp(text));
  assert.match(html, /role="status"/);
});

test("marks stale and unknown packages as requiring explicit regeneration without removing their exact export actions", () => {
  for (const freshness of ["stale", "unknown"]) {
    const html = renderToStaticMarkup(React.createElement(AiBriefPanel, { brief, freshness, onCopy() {}, onDownload() {} }));
    assert.match(html, new RegExp(`Source: ${freshness[0].toUpperCase()}${freshness.slice(1)}`));
    assert.match(html, /Regenerate it before treating it as current case context/);
    assert.match(html, /Copy AI Brief JSON/);
    assert.match(html, /Download AI Brief JSON/);
  }
});
