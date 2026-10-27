import assert from "node:assert/strict";
import test from "node:test";
import { buildAiBrief } from "./aiBrief.js";
import { AI_DRAFT_SCHEMA_ID, AI_DRAFT_SCHEMA_VERSION } from "./aiDraft.js";
import { AI_DRAFT_REQUEST_VERSION, buildAiDraftingRequest } from "./aiDraftRequest.js";

function source() { return { id: "case-request", name: "Synthetic request case", updatedAt: "2026-10-27T10:00:00.000Z", issues: [{ id: "issue-a", reference: "ISS-001", name: "Primary", status: "open" }], incidents: [{ id: "incident-a", title: "Recorded incident", eventDate: "2026-01-01", sequenceGroupId: "issue-a", sequenceGroup: "Primary" }], evidence: [], documents: [], ledger: [], strategy: [], watchItems: [] }; }

test("builds exact, provider-neutral requests for every professional family", () => {
  for (const [family, scope] of [["executive", "sequenceGroup"], ["management", "case"], ["investigation", "sequenceGroup"], ["client", "case"]]) {
    const brief = buildAiBrief(source(), { reportFamily: family, scope, issueId: scope === "sequenceGroup" ? "issue-a" : "", generatedAt: "2026-10-27T12:00:00.000Z" });
    const request = buildAiDraftingRequest(brief);
    assert.match(request, new RegExp(`ProveIt AI Drafting Request v${AI_DRAFT_REQUEST_VERSION}`));
    assert.match(request, new RegExp(`Intended professional report family: ${family}`));
    assert.match(request, new RegExp(`${AI_DRAFT_SCHEMA_ID} v${AI_DRAFT_SCHEMA_VERSION}`));
    assert.equal(request.endsWith(JSON.stringify(brief, null, 2)), true);
    assert.match(request, /Do not invent facts, records, verification states, citations/);
    if (scope === "sequenceGroup") assert.match(request, /canonical Issue ISS-001 \(issue-a\)/);
  }
});

test("is deterministic, preserves the exact Brief without mutation, and rejects invalid Briefs", () => {
  const caseItem = source();
  const brief = buildAiBrief(caseItem, { reportFamily: "investigation", scope: "sequenceGroup", issueId: "issue-a", generatedAt: "2026-10-27T12:00:00.000Z" });
  const before = structuredClone(brief);
  assert.equal(buildAiDraftingRequest(brief), buildAiDraftingRequest(brief));
  assert.deepEqual(brief, before);
  assert.throws(() => buildAiDraftingRequest({}), /valid AI Brief/);
});
