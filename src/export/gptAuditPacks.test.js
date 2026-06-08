import test from "node:test";
import assert from "node:assert/strict";

import {
  buildCaseSliceMarkdownPrompt,
  buildCaseSlicePack,
  buildChainCompletionMarkdownPrompt,
  buildChainCompletionPack,
  buildMissingFunctionSummaryMarkdownPrompt,
  buildMissingFunctionSummaryPack,
  buildUngroupedEvidenceAuditMarkdownPrompt,
  buildUngroupedEvidenceAuditPack,
  buildUngroupedIncidentsAuditMarkdownPrompt,
  buildUngroupedIncidentsAuditPack,
  buildWeakLinksAuditMarkdownPrompt,
  buildWeakLinksAuditPack,
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
      {
        id: "inc-no-evidence",
        title: "Incident without evidence",
        date: "2026-01-04",
        description: "Needs proof",
        linkedEvidenceIds: [],
        linkedRecordIds: ["missing-record-id"],
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
      {
        id: "ev-no-incident",
        title: "Evidence without incident",
        capturedAt: "2026-01-05",
        status: "needs_review",
        importance: "medium",
        relevance: "unknown",
        description: "No incident is linked yet",
        notes: "Review later",
        reviewNotes: "Possible cleanup candidate",
        functionSummary: "Shows a standalone issue needing placement.",
        evidenceRole: "supporting",
        type: "photo",
        sourceType: "user_uploaded",
        linkedIncidentIds: [],
        linkedRecordIds: [],
        attachments: [{ id: "ev-unlinked-att", dataUrl: "data:bad" }],
        sequenceGroup: "",
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
      {
        id: "doc-orphan",
        title: "Orphan document",
        documentDate: "2026-01-06",
        textContent: "Unlinked document text",
        linkedRecordIds: [],
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
      {
        id: "str-orphan",
        title: "Unlinked strategy",
        description: "No proof links",
        linkedRecordIds: [],
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
      {
        id: "ledger-orphan",
        label: "Unlinked ledger row",
        notes: "No proof links",
        linkedRecordIds: [],
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

test("ungrouped evidence audit pack includes only evidence without sequenceGroup and resolved links", () => {
  const pack = buildUngroupedEvidenceAuditPack(buildCase());

  assertSafePack(pack);
  assert.equal(pack.packType, "UNGROUPED_EVIDENCE_AUDIT_PACK");
  assert.deepEqual(pack.data.ungroupedEvidence.map((item) => item.record.id), ["ev-missing-summary", "ev-no-incident"]);
  assert.equal(pack.data.ungroupedEvidence[0].linkedIncidents.some((record) => record.id === "inc-ungrouped"), true);
  assert.equal(pack.data.ungroupedEvidence.some((item) => item.record.id === "ev-chain"), false);
});

test("weak links audit pack detects records without proof links and missing targets", () => {
  const pack = buildWeakLinksAuditPack(buildCase());

  assertSafePack(pack);
  assert.equal(pack.packType, "WEAK_LINKS_AUDIT_PACK");
  assert.equal(pack.data.incidentsWithoutEvidence.some((record) => record.id === "inc-no-evidence"), true);
  assert.equal(pack.data.evidenceWithoutIncidents.some((record) => record.id === "ev-no-incident"), true);
  assert.equal(pack.data.documentsWithoutLinks.some((record) => record.id === "doc-orphan"), true);
  assert.equal(pack.data.supportingRecordsWithoutProofLinks.some((record) => record.id === "ledger-orphan"), true);
  assert.equal(pack.data.missingLinkTargets.some((item) => item.missingTargetId === "missing-record-id"), true);
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

test("case slice pack includes selected records plus directly linked context", () => {
  const pack = buildCaseSlicePack(buildCase(), {
    incidents: ["inc-ungrouped"],
    documents: ["doc-1"],
  }, {
    limits: { documentTextChars: 50 },
  });

  assertSafePack(pack);
  assert.equal(pack.packType, "CASE_SLICE_PACK");
  assert.deepEqual(pack.data.selectedRecordIds.incidents, ["inc-ungrouped"]);
  assert.equal(pack.data.selectedRecords.some((item) => item.record?.id === "inc-ungrouped"), true);
  assert.equal(
    pack.data.selectedRecords
      .find((item) => item.record?.id === "inc-ungrouped")
      .linkedContext.some((record) => record.id === "ev-missing-summary"),
    true
  );
  const doc = pack.data.selectedRecords.find((item) => item.record?.id === "doc-1").record;
  assert.equal(doc.textContent.label, "UNTRUSTED_SOURCE_MATERIAL");
});

test("markdown prompts include required safety instructions", () => {
  const caseData = buildCase();
  const prompts = [
    buildCaseSliceMarkdownPrompt(caseData, { incidents: ["inc-ungrouped"] }),
    buildMissingFunctionSummaryMarkdownPrompt(caseData),
    buildUngroupedEvidenceAuditMarkdownPrompt(caseData),
    buildUngroupedIncidentsAuditMarkdownPrompt(caseData),
    buildChainCompletionMarkdownPrompt(caseData, "Repair Chain"),
    buildWeakLinksAuditMarkdownPrompt(caseData),
  ];

  for (const prompt of prompts) {
    assert.match(prompt, /Do not invent facts/);
    assert.match(prompt, /Do not generate deltas/);
    assert.match(prompt, /record IDs/);
    assert.match(prompt, /untrusted source material/);
  }
});
