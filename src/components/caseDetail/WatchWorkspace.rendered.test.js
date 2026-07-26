import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { transformWithOxc } from "vite";

const runtimeUrl = import.meta.resolve("react/jsx-runtime");
const reactUrl = import.meta.resolve("react");
const toDataUrl = (code) => `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`;
const transformModule = async (url, replacements = []) => {
  const transformed = await transformWithOxc(await readFile(url, "utf8"), url.pathname);
  let code = transformed.code
    .replaceAll('from "react/jsx-runtime"', `from "${runtimeUrl}"`)
    .replaceAll('from "react"', `from "${reactUrl}"`);
  for (const [from, to] of replacements) code = code.replace(from, to);
  return toDataUrl(code);
};

const shellUrl = await transformModule(new URL("../shared/RecordCardShell.jsx", import.meta.url));
const badgeUrl = await transformModule(new URL("../shared/RecordBadge.jsx", import.meta.url));
const actionsUrl = await transformModule(new URL("../shared/RecordActions.jsx", import.meta.url));
const metadataUrl = await transformModule(new URL("../shared/RecordMetadataRow.jsx", import.meta.url));
const linksUrl = await transformModule(new URL("../shared/RecordLinksRow.jsx", import.meta.url));
const resolverUrl = toDataUrl('export function getRecordDisplayMeta(caseItem, id) { for (const type of ["incidents", "evidence", "documents", "ledger", "strategy", "watchItems"]) { const record = (caseItem[type] || []).find((entry) => entry.id === id); if (record) return { ...record, typeLabel: type }; } return null; }');
const cardUrl = await transformModule(new URL("./WatchItemCard.jsx", import.meta.url), [
  ['from "../../domain/linkingResolvers.js"', `from "${resolverUrl}"`],
  ['from "../shared/RecordActions.jsx"', `from "${actionsUrl}"`],
  ['from "../shared/RecordBadge.jsx"', `from "${badgeUrl}"`],
  ['from "../shared/RecordMetadataRow.jsx"', `from "${metadataUrl}"`],
  ['from "../shared/RecordLinksRow.jsx"', `from "${linksUrl}"`],
  ['from "../shared/RecordCardShell.jsx"', `from "${shellUrl}"`],
]);
const editorStubUrl = toDataUrl(`import { jsx } from "${runtimeUrl}"; export default function Stub() { return jsx("div", {}); }`);
const domainStubUrl = toDataUrl('export const WATCH_CATEGORIES = ["commitment"]; export const WATCH_PRIORITIES = ["high"]; export const WATCH_STATUSES = ["watching"]; export const cleanupDeletedRecordLinks = (value) => value; export const generateId = () => "generated"; export const normalizeRecord = (value) => value; export const normalizeWatchItem = (value) => value;');
const helperStubUrl = toDataUrl('export const filterAndSortWatchItems = (items) => items; export const getWatchReviewState = () => "scheduled"; export const isWatchItemUnlinked = () => false; export const prepareWatchItemForm = (item) => item || {};');
const workspaceUrl = await transformModule(new URL("./WatchWorkspace.jsx", import.meta.url), [
  ['from "../StringListEditor.jsx"', `from "${editorStubUrl}"`],
  ['from "./LinkedPartiesSelector.jsx"', `from "${editorStubUrl}"`],
  ['from "../../domain/caseDomain.js"', `from "${domainStubUrl}"`],
  ['from "./watchWorkspaceHelpers.js"', `from "${helperStubUrl}"`],
  ['from "./WatchItemCard.jsx"', `from "${cardUrl}"`],
]);
const { default: WatchWorkspace } = await import(workspaceUrl);

test("the active Watch workspace renders one shared shell per visible item", () => {
  const item = {
    id: "watch-rendered-1", title: "Monitor the promised review", status: "watching", category: "commitment", priority: "high",
    date: "2026-07-01", reviewDate: "2026-08-01", updatedAt: "2026-07-20", watchFor: "Whether the review occurs as promised.",
    triggerConditions: ["The review date passes without action"], latestObservation: "No meeting invitation has been received.",
    rationale: "The promised review affects the investigation plan.", nextCheck: "Check the calendar on 1 August.", outcome: "",
    observations: [{ id: "observation-1", text: "No invitation", date: "2026-07-20" }], tags: ["review"],
    linkedRecordIds: ["incident-1"], linkedPartyIds: ["party-1"], attachments: [{ id: "attachment-1", name: "review-note.pdf" }], sequenceGroup: "Review process",
  };
  const caseItem = { id: "case-rendered", watchItems: [item], incidents: [{ id: "incident-1", title: "Review promised" }], evidence: [], documents: [], ledger: [], strategy: [], parties: [{ id: "party-1", displayName: "Case reviewer" }] };
  const markup = renderToStaticMarkup(React.createElement(WatchWorkspace, { caseItem, onUpdateCase() {} }));

  assert.match(markup, /data-watch-workspace="true"/);
  assert.match(markup, /data-watch-card-list="true"/);
  assert.equal((markup.match(/data-record-card-shell="true"/g) || []).length, 1);
  assert.equal((markup.match(/<article/g) || []).length, 1);
  assert.match(markup, /<h3[^>]*>Monitor the promised review<\/h3>/);
  for (const text of ["Watching", "High", "Date added:", "Linked records", "What is being monitored", "Latest development", "Escalation triggers", "Edit", "Escalate to Incident", "Convert to Strategy", "Delete"]) assert.match(markup, new RegExp(text));
  assert.ok(markup.indexOf("Date added:") < markup.indexOf("Linked records"));
  assert.ok(markup.indexOf("Linked records") < markup.indexOf("What is being monitored"));
});
