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
  let code = transformed.code.replaceAll('from "react/jsx-runtime"', `from "${runtimeUrl}"`).replaceAll('from "react"', `from "${reactUrl}"`);
  for (const [from, to] of replacements) code = code.replace(from, to);
  return toDataUrl(code);
};

const editorUrl = toDataUrl(`import { jsx } from "${runtimeUrl}"; export default function Editor() { return jsx("div", {}); }`);
const badgeUrl = toDataUrl(`import { jsx } from "${runtimeUrl}"; export default function Badge({ children }) { return jsx("span", { children }); }`);
const issueDomainUrl = toDataUrl('export const getIssueDisplayLabel = (issue) => `${issue.reference} — ${issue.name}`;');
const goalDomainUrl = toDataUrl('export const GOAL_PRIORITIES = ["low", "medium", "high", "critical"]; export const GOAL_STATUSES = ["active", "achieved", "abandoned", "archived"];');
const helpersUrl = toDataUrl('export const getVisibleGoals = (goals, view) => view === "all" ? goals : goals.filter((goal) => goal.status === "active"); export const prepareGoalDraft = () => ({}); export const saveGoalToCase = () => ({}); export const toggleGoalIssueId = () => [];');
const workspaceUrl = await transformModule(new URL("./GoalWorkspace.jsx", import.meta.url), [
  ['from "../StringListEditor.jsx"', `from "${editorUrl}"`],
  ['from "../shared/RecordBadge.jsx"', `from "${badgeUrl}"`],
  ['from "../../domain/issueDomain.js"', `from "${issueDomainUrl}"`],
  ['from "../../domain/goalDomain.js"', `from "${goalDomainUrl}"`],
  ['from "./goalWorkspaceHelpers.js"', `from "${helpersUrl}"`],
]);
const { default: GoalWorkspace } = await import(workspaceUrl);

test("Goals workspace renders active canonical Goals and leaves legacy cases usable", () => {
  const caseItem = {
    id: "case", issues: [{ id: "issue-1", reference: "ISS-009", name: "Heating" }],
    goals: [{ id: "goal-1", title: "Restore heating", description: "Secure a repair", successCriteria: ["Heating works"], status: "active", priority: "high", issueIds: ["issue-1"], reviewDate: "2026-10-01" }],
  };
  const markup = renderToStaticMarkup(React.createElement(GoalWorkspace, { caseItem, onUpdateCase() {} }));
  for (const text of ["Goals", "Desired outcomes", "Restore heating", "Secure a repair", "Active", "Priority: High", "Review: 2026-10-01", "ISS-009 — Heating"]) assert.match(markup, new RegExp(text));
  const legacyMarkup = renderToStaticMarkup(React.createElement(GoalWorkspace, { caseItem: { id: "legacy", strategy: [{ id: "strategy" }] }, onUpdateCase() {} }));
  assert.match(legacyMarkup, /No Goals yet/);
});
