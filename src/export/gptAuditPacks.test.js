import test from "node:test";
import assert from "node:assert/strict";

import {
  buildCaseSliceMarkdownPrompt,
  buildCaseSlicePack,
  buildChainCompletionMarkdownPrompt,
  buildChainCompletionPack,
  buildFullChainGptMarkdownPrompt,
  buildFullChainGptPack,
  buildManagementReportBuilderMarkdownPrompt,
  buildManagementReportBuilderPack,
  buildManagementReportBuilderSpecialistPrompt,
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
        linkedRecordIds: ["doc-external"],
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
        attachments: [{
          id: "att-chain",
          filename: "repair-photo.jpg",
          fileType: "image/jpeg",
          capturedAt: "2026-01-02T10:00:00Z",
          dataUrl: "data:image/jpeg;base64,chain",
        }],
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
        id: "doc-chain-duplicate",
        title: "Source document",
        documentDate: "2026-01-04",
        summary: "Possible duplicate document",
        textContent: "Duplicate document text",
        linkedRecordIds: [],
        sequenceGroup: "Repair Chain",
      },
      {
        id: "doc-external",
        title: "External linked document",
        documentDate: "2026-01-07",
        textContent: "External document text",
        linkedRecordIds: [],
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
  assert.equal(pack.exportMetadata.includesEvidenceFiles, false);
  assert.equal(pack.exportMetadata.includesPrivateNotes, true);
  assert.equal(pack.exportMetadata.includesPinData, false);
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

test("full chain GPT pack includes complete safe chain records, external links, and diagnostics", () => {
  const pack = buildFullChainGptPack(buildCase(), "Repair Chain", {
    limits: { documentTextChars: 50 },
    sequenceGroupMeta: {
      "Repair Chain": {
        description: "Repairs and proof chain.",
      },
    },
  });

  assertSafePack(pack);
  assert.equal(pack.packType, "FULL_CHAIN_GPT_PACK");
  assert.equal(pack.exportMetadata.label, "Specialist Handoff");
  assert.equal(pack.data.sequenceGroup.name, "Repair Chain");
  assert.equal(pack.data.sequenceGroup.description, "Repairs and proof chain.");
  assert.deepEqual(pack.data.incidents.map((record) => record.id), ["inc-chain", "inc-no-evidence"]);
  assert.equal(pack.data.evidence.some((record) => record.id === "ev-chain"), true);
  assert.equal(pack.data.evidence[0].attachmentInfo.count, 1);
  assert.equal(pack.data.evidence[0].attachmentInfo.items[0].filename, "repair-photo.jpg");
  assert.equal(pack.data.evidence[0].attachmentInfo.warning, "Attachment exists but readable extracted text is not available in this pack.");
  assert.equal(pack.data.documents.find((record) => record.id === "doc-1").textContent.label, "UNTRUSTED_SOURCE_MATERIAL");
  assert.ok(pack.data.documents.find((record) => record.id === "doc-1").textContent.excerpt.length <= 53);
  assert.equal(pack.data.externalLinkedRecords.some((record) => record.id === "doc-external"), true);
  assert.equal(pack.data.externalLinkedRecords.some((record) => record.id === "inc-ungrouped"), true);
  assert.equal(pack.data.externalLinkedRecords.some((record) => record.id === "ev-no-incident"), false);
  assert.equal(pack.data.diagnostics.incidentsWithoutEvidence.some((record) => record.id === "inc-no-evidence"), true);
  assert.equal(pack.data.diagnostics.evidenceMissingFunctionSummary.some((record) => record.id === "ev-chain"), true);
  assert.equal(pack.data.diagnostics.documentsWithoutProofLinks.some((record) => record.id === "doc-chain-duplicate"), true);
  assert.equal(pack.data.diagnostics.duplicateCandidates.some((item) => item.recordIds.includes("doc-1") && item.recordIds.includes("doc-chain-duplicate")), true);
});

test("management report builder pack includes sequence chains, source IDs, and safe report handoff records", () => {
  const pack = buildManagementReportBuilderPack(buildCase(), "", {
    limits: { documentTextChars: 50 },
  });

  assertSafePack(pack);
  assert.equal(pack.packType, "MANAGEMENT_REPORT_BUILDER_PACK");
  assert.equal(pack.exportMetadata.label, "Specialist Handoff");
  assert.equal(pack.data.scope.type, "wholeCase");
  assert.equal(pack.data.sequenceChains.some((chain) => chain.name === "Repair Chain"), true);
  assert.equal(pack.data.sourceIds.includes("inc-chain"), true);
  assert.equal(pack.data.sourceIds.includes("ev-chain"), true);
  assert.equal(pack.data.sourceIds.includes("doc-1"), true);
  assert.equal(pack.data.sourceIds.includes("ledger-chain"), true);

  const chain = pack.data.sequenceChains.find((item) => item.name === "Repair Chain");
  const evidence = chain.sourceRecords.evidence.find((record) => record.id === "ev-chain");
  const document = chain.sourceRecords.documents.find((record) => record.id === "doc-1");

  assert.equal(evidence.establishes, "proof");
  assert.equal(evidence.establishesSource, "evidence.functionSummary");
  assert.equal(evidence.attachmentInfo.count, 1);
  assert.equal(document.referenceOnly, true);
  assert.equal(document.textContent.label, "UNTRUSTED_SOURCE_MATERIAL");
  assert.ok(document.textContent.excerpt.length <= 53);
  assert.match(pack.data.sourceRules.documents, /reference-only/);
});

test("management report builder pack can scope to a single sequence group", () => {
  const pack = buildManagementReportBuilderPack(buildCase(), "Repair Chain");

  assertSafePack(pack);
  assert.equal(pack.data.scope.type, "singleSequenceGroup");
  assert.equal(pack.data.scope.sequenceGroup, "Repair Chain");
  assert.deepEqual(pack.data.sequenceChains.map((chain) => chain.name), ["Repair Chain"]);
});

test("markdown prompts include required safety instructions", () => {
  const caseData = buildCase();
  const prompts = [
    buildCaseSliceMarkdownPrompt(caseData, { incidents: ["inc-ungrouped"] }),
    buildMissingFunctionSummaryMarkdownPrompt(caseData),
    buildUngroupedEvidenceAuditMarkdownPrompt(caseData),
    buildUngroupedIncidentsAuditMarkdownPrompt(caseData),
    buildChainCompletionMarkdownPrompt(caseData, "Repair Chain"),
    buildFullChainGptMarkdownPrompt(caseData, "Repair Chain"),
    buildManagementReportBuilderMarkdownPrompt(caseData),
    buildWeakLinksAuditMarkdownPrompt(caseData),
  ];

  for (const prompt of prompts) {
    assert.match(prompt, /Do not invent facts/);
    assert.match(prompt, /Do not generate deltas/);
    assert.match(prompt, /record IDs/);
    assert.match(prompt, /untrusted source material/);
  }
});

test("management report builder markdown prompt includes specialist report and visual layout instructions", () => {
  const prompt = buildManagementReportBuilderMarkdownPrompt(buildCase(), "Repair Chain");

  assert.match(prompt, /Report Builder GPT/);
  assert.match(prompt, /You are a specialist Report Builder GPT/);
  assert.match(prompt, /Visual Report Layout Plan/);
  assert.match(prompt, /Suggested Image Prompt for final report image/);
  assert.match(prompt, /image-style report layout/);
  assert.match(prompt, /Do not invent facts/);
  assert.match(prompt, /Do not generate ProveIt delta JSON/);
  assert.match(prompt, /Unsupported or weak claims list/);
});

test("management report builder specialist prompt embeds selected pack and requires handoff-only analysis", () => {
  const prompt = buildManagementReportBuilderSpecialistPrompt(buildCase(), "Repair Chain", {
    limits: { documentTextChars: 50 },
  });

  assert.match(prompt, /Work & Labour \/ Management Analysis Specialist/);
  assert.match(prompt, /Your job is not to write the final report/);
  assert.match(prompt, /produce a Management Analysis Handoff for a Report Builder GPT/);
  assert.match(prompt, /The ProveIt pack is the factual source/);
  assert.match(prompt, /Do not invent facts/);
  assert.match(prompt, /Do not invent evidence/);
  assert.match(prompt, /Do not change record IDs/);
  assert.match(prompt, /Do not generate ProveIt deltas/);
  assert.match(prompt, /# Management Analysis Handoff/);
  assert.match(prompt, /## Executive Narrative/);
  assert.match(prompt, /## Management Position/);
  assert.match(prompt, /## Why This Matters/);
  assert.match(prompt, /## Key Themes/);
  assert.match(prompt, /## Management Attention Required/);
  assert.match(prompt, /## Strongest Positions/);
  assert.match(prompt, /## Weakest Positions/);
  assert.match(prompt, /## Risk Assessment/);
  assert.match(prompt, /## Case Health Assessment/);
  assert.match(prompt, /## Open Questions/);
  assert.match(prompt, /## Report Builder Guidance/);
  assert.match(prompt, /## Specialist Notes/);
  assert.match(prompt, /"packType": "MANAGEMENT_REPORT_BUILDER_PACK"/);
  assert.match(prompt, /"scope": \{\n {6}"type": "singleSequenceGroup",\n {6}"sequenceGroup": "Repair Chain"/);
  assert.match(prompt, /"id": "ev-chain"/);
  assert.doesNotMatch(prompt, /data:image/);
  assert.doesNotMatch(prompt, /backupDataUrl/);
});
