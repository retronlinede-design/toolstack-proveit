import test from "node:test";
import assert from "node:assert/strict";

import {
  buildChainCompletionMarkdownPrompt,
  buildChainCompletionPack,
  buildMissingFunctionSummaryMarkdownPrompt,
  buildMissingFunctionSummaryPack,
  buildUngroupedIncidentsAuditMarkdownPrompt,
  buildUngroupedIncidentsAuditPack,
} from "./gptAuditPacks.js";

function buildCase() {
  return {
    id: "case-1",
    name: "AI tools case",
    category: "housing",
    status: "open",
    incidents: [
      {
        id: "inc-ungrouped",
        title: "Ungrouped incident",
        date: "2026-01-01",
        eventDate: "2026-01-01",
        status: "open",
        evidenceStatus: "needs_evidence",
        description: "Incident description",
        notes: "Incident notes",
        linkedEvidenceIds: ["ev-missing-summary"],
        linkedRecordIds: ["doc-1"],
        sequenceGroup: "",
      },
      {
        id: "inc-chain",
        title: "Chain incident",
        date: "2026-01-02",
        eventDate: "2026-01-02",
        status: "open",
        evidenceStatus: "documented",
        description: "Grouped incident description",
        notes: "",
        linkedEvidenceIds: ["ev-chain"],
        sequenceGroup: "Repair Chain",
      },
    ],
    evidence: [
      {
        id: "ev-missing-summary",
        title: "Evidence needs summary",
        date: "2026-01-01",
        status: "needs_review",
        importance: "strong",
        relevance: "high",
        description: "Evidence description",
        notes: "Evidence notes",
        functionSummary: "",
        linkedIncidentIds: ["inc-ungrouped"],
        attachments: [{
          id: "att-1",
          name: "photo.png",
          dataUrl: "data:image/png;base64,abc",
          backupDataUrl: "data:image/png;base64,backup",
        }],
        availability: {
          digital: {
            hasDigital: true,
            files: [{ id: "file-1", dataUrl: "data:bad" }],
          },
        },
        sequenceGroup: "",
      },
      {
        id: "ev-chain",
        title: "Chain evidence",
        date: "2026-01-02",
        status: "needs_review",
        importance: "critical",
        relevance: "high",
        description: "Chain evidence description",
        functionSummary: "proof",
        linkedIncidentIds: ["inc-chain"],
        sequenceGroup: "Repair Chain",
      },
    ],
    documents: [
      {
        id: "doc-1",
        title: "Source document",
        documentDate: "2026-01-03",
        summary: "Document summary",
        textContent: "A".repeat(1500),
        linkedRecordIds: ["inc-ungrouped"],
        attachments: [{ id: "doc-att", dataUrl: "data:bad" }],
        sequenceGroup: "Repair Chain",
      },
    ],
    strategy: [
      {
        id: "str-chain",
        title: "Strategy",
        description: "Strategy description",
        linkedRecordIds: ["inc-chain"],
        sequenceGroup: "Repair Chain",
      },
    ],
    ledger: [
      {
        id: "ledger-chain",
        label: "Ledger row",
        notes: "Ledger notes",
        linkedRecordIds: ["ev-chain"],
        sequenceGroup: "Repair Chain",
      },
    ],
  };
}

function assertSafePack(pack) {
  const serialized = JSON.stringify(pack);
  assert.equal(pack.importable, false);
  assert.equal(pack.includesBinaryData, false);
  assert.match(serialized, /Do not invent facts/);
  assert.match(serialized, /Do not generate deltas/);
  assert.doesNotMatch(serialized, /dataUrl/);
  assert.doesNotMatch(serialized, /backupDataUrl/);
  assert.doesNotMatch(serialized, /arrayBuffer/);
  assert.doesNotMatch(serialized, /attachments/);
}

test("missing function summary pack preserves evidence ids and strips binaries", () => {
  const pack = buildMissingFunctionSummaryPack(buildCase(), {
    limits: { documentTextChars: 40 },
  });

  assertSafePack(pack);
  assert.equal(pack.packType, "MISSING_FUNCTION_SUMMARY_PACK");
  assert.deepEqual(
    pack.data.evidenceNeedingFunctionSummary.map((item) => item.record.id),
    ["ev-missing-summary", "ev-chain"]
  );
  assert.equal(pack.data.evidenceNeedingFunctionSummary[0].linkedContext.some((record) => record.id === "inc-ungrouped"), true);
});

test("ungrouped incidents audit pack includes only ungrouped incidents and existing group context", () => {
  const pack = buildUngroupedIncidentsAuditPack(buildCase());

  assertSafePack(pack);
  assert.equal(pack.packType, "UNGROUPED_INCIDENTS_AUDIT_PACK");
  assert.deepEqual(pack.data.ungroupedIncidents.map((item) => item.record.id), ["inc-ungrouped"]);
  assert.equal(pack.data.existingSequenceGroups.some((group) => group.name === "Repair Chain"), true);
});

test("chain completion pack scopes records to one sequence group and labels bounded document text", () => {
  const pack = buildChainCompletionPack(buildCase(), "Repair Chain", {
    limits: { documentTextChars: 50 },
  });

  assertSafePack(pack);
  assert.equal(pack.packType, "CHAIN_COMPLETION_PACK");
  assert.equal(pack.data.sequenceGroup.name, "Repair Chain");
  assert.equal(pack.data.chainRecords.some((item) => item.record.id === "inc-chain"), true);
  assert.equal(pack.data.chainRecords.some((item) => item.record.id === "inc-ungrouped"), false);
  const doc = pack.data.chainRecords.find((item) => item.record.id === "doc-1").record;
  assert.equal(doc.textContent.label, "UNTRUSTED_SOURCE_MATERIAL");
  assert.ok(doc.textContent.excerpt.length <= 53);
});

test("markdown prompts include required safety instructions", () => {
  const caseData = buildCase();
  const prompts = [
    buildMissingFunctionSummaryMarkdownPrompt(caseData),
    buildUngroupedIncidentsAuditMarkdownPrompt(caseData),
    buildChainCompletionMarkdownPrompt(caseData, "Repair Chain"),
  ];

  for (const prompt of prompts) {
    assert.match(prompt, /Do not invent facts/);
    assert.match(prompt, /Do not generate deltas/);
    assert.match(prompt, /record IDs/);
  }
});

