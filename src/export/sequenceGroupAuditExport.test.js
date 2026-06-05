import test from "node:test";
import assert from "node:assert/strict";

import {
  buildSequenceGroupAuditReport,
  exportSequenceGroupAuditJson,
  exportSequenceGroupAuditMarkdown,
} from "./sequenceGroupAuditExport.js";

function buildAuditCase() {
  return {
    id: "case_consulate_001",
    name: "Consulate case",
    category: "housing",
    status: "open",
    incidents: [
      {
        id: "inc-group-1",
        title: "Mould discovered",
        date: "2024-01-02",
        eventDate: "2024-01-01",
        status: "open",
        evidenceStatus: "needs_evidence",
        sequenceGroup: "mould_safety_chain_001",
        isMilestone: true,
        description: "Mould appeared around the bedroom wall.",
        notes: "",
        tags: ["mould"],
        linkedEvidenceIds: ["ev-linked-1"],
        linkedRecordIds: ["doc-linked-1"],
        linkedIncidentRefs: [{ incidentId: "inc-external-1", type: "RELATED_TO" }],
      },
      {
        id: "inc-group-2",
        title: "Health symptoms",
        date: "2024-01-04",
        eventDate: "2024-01-04",
        status: "open",
        evidenceStatus: "documented",
        sequenceGroup: "mould_safety_chain_001",
        description: "",
        notes: "",
        linkedEvidenceIds: [],
        linkedRecordIds: [],
      },
      {
        id: "inc-other-group",
        title: "Rent dispute",
        date: "2024-02-01",
        eventDate: "2024-02-01",
        status: "open",
        evidenceStatus: "documented",
        sequenceGroup: "rent_chain_001",
        description: "Separate rent issue.",
        notes: "Not part of mould thread.",
        linkedEvidenceIds: ["ev-other-1"],
      },
      {
        id: "inc-external-1",
        title: "Landlord ignored repair",
        date: "2024-01-03",
        eventDate: "2024-01-03",
        status: "open",
        evidenceStatus: "documented",
        sequenceGroup: "repair_chain_001",
        description: "Linked external repair event.",
        notes: "Outside the selected group.",
      },
    ],
    evidence: [
      {
        id: "ev-linked-1",
        title: "Mould photo",
        date: "2024-01-01",
        status: "verified",
        importance: "critical",
        relevance: "high",
        evidenceRole: "ANCHOR_EVIDENCE",
        functionSummary: "Photo shows the visible mould condition in the bedroom.",
        notes: "Original retained.",
        attachments: [
          {
            name: "mould.png",
            type: "image",
            createdAt: "2024-01-01T10:00:00.000Z",
            dataUrl: "data:image/png;base64,abc",
          },
        ],
        linkedIncidentIds: ["inc-group-1", "inc-other-group"],
        linkedRecordIds: ["doc-linked-1"],
      },
      {
        id: "ev-group-unused",
        title: "Unassigned air reading",
        date: "2024-01-05",
        status: "needs_review",
        importance: "supporting",
        relevance: "medium",
        evidenceRole: "OTHER",
        functionSummary: "Proof",
        notes: "",
        sequenceGroup: "mould_safety_chain_001",
        linkedIncidentIds: [],
        linkedRecordIds: [],
      },
      {
        id: "ev-other-1",
        title: "Rent receipt",
        date: "2024-02-01",
        status: "verified",
        importance: "supporting",
        relevance: "medium",
        evidenceRole: "OTHER",
        functionSummary: "Rent proof.",
        linkedIncidentIds: ["inc-other-group"],
      },
    ],
    documents: [
      {
        id: "doc-linked-1",
        title: "Inspection email",
        documentDate: "2024-01-02",
        category: "email",
        summary: "Email confirming inspection.",
        linkedRecordIds: ["inc-group-1", "ev-linked-1"],
        attachments: [
          {
            name: "inspection.eml",
            mimeType: "message/rfc822",
            createdAt: "2024-01-02T10:00:00.000Z",
            payload: "raw message",
          },
        ],
      },
      {
        id: "doc-other-1",
        title: "Other case note",
        documentDate: "2024-02-02",
        linkedRecordIds: ["inc-other-group"],
      },
    ],
    strategy: [
      {
        id: "str-group-1",
        title: "Escalate mould safety",
        sequenceGroup: "mould_safety_chain_001",
        linkedRecordIds: [],
      },
    ],
  };
}

test("buildSequenceGroupAuditReport includes only selected sequence group incidents", () => {
  const report = buildSequenceGroupAuditReport(buildAuditCase(), "mould_safety_chain_001");

  assert.deepEqual(report.incidents.map((incident) => incident.id), ["inc-group-1", "inc-group-2"]);
  assert.equal(report.incidents.some((incident) => incident.id === "inc-other-group"), false);
});

test("buildSequenceGroupAuditReport includes linked evidence and document metadata without binary data", () => {
  const report = buildSequenceGroupAuditReport(buildAuditCase(), "mould_safety_chain_001");
  const evidence = report.evidence.find((item) => item.id === "ev-linked-1");
  const document = report.documents.find((item) => item.id === "doc-linked-1");
  const serialized = JSON.stringify(report);

  assert.ok(evidence);
  assert.deepEqual(evidence.attachments, [
    {
      filename: "mould.png",
      type: "image",
      createdAt: "2024-01-01T10:00:00.000Z",
      metadataAvailable: true,
    },
  ]);
  assert.ok(document);
  assert.equal(serialized.includes("data:image/png;base64"), false);
  assert.equal(serialized.includes("raw message"), false);
});

test("buildSequenceGroupAuditReport marks external linked incidents", () => {
  const report = buildSequenceGroupAuditReport(buildAuditCase(), "mould_safety_chain_001");
  const external = report.externalLinkedRecords.find((item) => item.id === "inc-external-1");

  assert.ok(external);
  assert.equal(external.externalLinkedRecord, true);
  assert.equal(external.sequenceGroup, "repair_chain_001");
  assert.equal(report.incidents.some((incident) => incident.id === "inc-external-1"), false);
});

test("buildSequenceGroupAuditReport flags unsupported incidents and unused evidence", () => {
  const report = buildSequenceGroupAuditReport(buildAuditCase(), "mould_safety_chain_001");

  assert.ok(report.unsupportedIncidents.find((item) => item.id === "inc-group-1"));
  assert.ok(report.unusedEvidence.find((item) => item.id === "ev-group-unused"));
});

test("buildSequenceGroupAuditReport flags weak records and unrelated sequence group evidence links", () => {
  const report = buildSequenceGroupAuditReport(buildAuditCase(), "mould_safety_chain_001");

  assert.ok(report.weakRecords.find((item) => item.id === "inc-group-2" && item.code === "group_record_zero_links"));
  assert.ok(report.weakRecords.find((item) => item.id === "ev-group-unused" && item.code === "vague_function_summary"));
  assert.ok(report.diagnostics.evidenceLinkedToUnrelatedSequenceGroups.find((item) =>
    item.id === "ev-linked-1" &&
    item.linkedIncidentId === "inc-other-group" &&
    item.linkedSequenceGroup === "rent_chain_001"
  ));
});

test("exportSequenceGroupAuditJson is valid complete JSON", () => {
  const payload = exportSequenceGroupAuditJson(buildAuditCase(), "mould_safety_chain_001");
  const parsed = JSON.parse(JSON.stringify(payload));

  assert.equal(parsed.exportType, "SEQUENCE_GROUP_FULL_RECORD_AUDIT_REPORT");
  assert.equal(parsed.importable, false);
  assert.equal(parsed.includesBinaryData, false);
  assert.equal(parsed.evidence.length, 2);
  assert.equal(parsed.gptAuditPromptBlock.includes("Please audit this sequence group"), true);
});

test("buildSequenceGroupAuditReport handles older missing fields safely", () => {
  const report = buildSequenceGroupAuditReport({
    id: "legacy-case",
    incidents: [
      {
        id: "legacy-inc",
        title: "Legacy incident",
        sequenceGroup: "legacy_group",
      },
    ],
  }, "legacy_group");

  assert.equal(report.case.id, "legacy-case");
  assert.deepEqual(report.incidents[0].linkedEvidenceIds, []);
  assert.deepEqual(report.incidents[0].incidentLinks, { causes: [], outcomes: [], related: [] });
  assert.deepEqual(report.evidence, []);
});

test("exportSequenceGroupAuditMarkdown includes required sections", () => {
  const markdown = exportSequenceGroupAuditMarkdown(buildAuditCase(), "mould_safety_chain_001");

  assert.match(markdown, /## Thread overview/);
  assert.match(markdown, /## Chronology table/);
  assert.match(markdown, /## GPT audit prompt block/);
});
