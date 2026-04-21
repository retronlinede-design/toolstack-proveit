import test from "node:test";
import assert from "node:assert/strict";

import { buildNarrativeSections } from "./narrativeBuilder.js";

function buildNarrativeCase() {
  return {
    id: "case-1",
    name: "Narrative test case",
    category: "housing",
    status: "open",
    incidents: [
      {
        id: "inc-2",
        title: "Repair missed",
        date: "2024-03-15",
        description: "No contractor arrived on the promised date.",
        notes: "I waited at home all day.",
        linkedEvidenceIds: ["ev-2"],
        linkedRecordIds: ["doc-1"],
      },
      {
        id: "inc-1",
        title: "Leak reported",
        date: "2024-03-10",
        description: "I reported the bathroom leak to the landlord.",
        notes: "",
        linkedEvidenceIds: ["ev-1"],
        linkedRecordIds: ["rec-1"],
      },
    ],
    evidence: [
      {
        id: "ev-1",
        type: "evidence",
        title: "WhatsApp screenshot",
        date: "2024-03-10",
        description: "Screenshot of the leak report message.",
        functionSummary: "Helps prove the landlord was notified about the leak on 10 March.",
        sequenceGroup: "Leak notice sequence",
        evidenceRole: "COMMUNICATION_EVIDENCE",
        linkedIncidentIds: ["inc-1"],
      },
      {
        id: "ev-2",
        type: "evidence",
        title: "Call log",
        date: "2024-03-15",
        description: "Phone call log for follow-up.",
        functionSummary: "Helps prove I followed up when the promised repair did not happen.",
        sequenceGroup: "",
        evidenceRole: "TIMELINE_EVIDENCE",
        linkedIncidentIds: ["inc-2"],
      },
      {
        id: "ev-3",
        type: "evidence",
        title: "Photo of damage",
        date: "2024-03-11",
        description: "Photo of stained ceiling.",
        functionSummary: "Helps visually confirm the ceiling damage after the leak.",
        sequenceGroup: "Damage photos",
        evidenceRole: "CORROBORATING_EVIDENCE",
        linkedIncidentIds: ["inc-1"],
      },
    ],
    documents: [
      {
        id: "doc-1",
        title: "Landlord email",
        summary: "Email promising a contractor visit on 15 March.",
        textContent: "Plain document body",
      },
      {
        id: "rec-1",
        title: "Maintenance tracker",
        summary: "",
        textContent: `[TRACK RECORD]

meta:
type: compliance
subject: Leak follow-up

--- TABLE ---
| Date | Note |
|------|------|
| 2024-03-10 | Reported leak |

--- SUMMARY (GPT READY) ---

Shows the maintenance follow-up timeline.

--- FILE LINKS ---

--- NOTES ---
`,
      },
    ],
    tasks: [],
    strategy: [],
  };
}

test("buildNarrativeSections sorts incidents and builds incident-anchored sections", () => {
  const sections = buildNarrativeSections(buildNarrativeCase());

  assert.equal(sections.length, 2);
  assert.equal(sections[0].date, "2024-03-10");
  assert.equal(sections[0].incident.id, "inc-1");
  assert.equal(sections[1].incident.id, "inc-2");
});

test("buildNarrativeSections attaches linked evidence from explicit and reverse incident links", () => {
  const sections = buildNarrativeSections(buildNarrativeCase());

  assert.deepEqual(
    sections[0].supportingEvidence.map((item) => item.id),
    ["ev-1", "ev-3"]
  );
  assert.equal(
    sections[0].supportingEvidence[0].functionSummary,
    "Helps prove the landlord was notified about the leak on 10 March."
  );
});

test("buildNarrativeSections resolves linked records and maps tracking documents as record type", () => {
  const sections = buildNarrativeSections(buildNarrativeCase());

  assert.deepEqual(sections[0].supportingRecords, [
    {
      id: "rec-1",
      title: "Maintenance tracker",
      summary: "Shows the maintenance follow-up timeline.",
      recordType: "record",
    },
  ]);

  assert.deepEqual(sections[1].supportingRecords, [
    {
      id: "doc-1",
      title: "Landlord email",
      summary: "Email promising a contractor visit on 15 March.",
      recordType: "document",
    },
  ]);
});

test("buildNarrativeSections derives establishes statements conservatively from function summaries", () => {
  const sections = buildNarrativeSections(buildNarrativeCase());

  assert.deepEqual(sections[0].establishes, [
    "Helps prove the landlord was notified about the leak on 10 March.",
    "Helps visually confirm the ceiling damage after the leak.",
  ]);
});
