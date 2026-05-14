import test from "node:test";
import assert from "node:assert/strict";

import {
  buildGptDeltaPreview,
  ingestGptDelta,
  prepareGptDeltaPayloadForSelectedCase,
} from "./gptDelta.js";

function baseCase() {
  return {
    id: "case-1",
    name: "Case One",
    actionSummary: {
      currentFocus: "Old focus",
      nextActions: ["Old action"],
      importantReminders: ["Old reminder"],
      strategyFocus: ["Old strategy"],
      criticalDeadlines: ["Old deadline"],
      updatedAt: "old-action-summary-time",
    },
    strategy: [
      {
        id: "str-1",
        type: "strategy",
        title: "Old strategy record",
        date: "2024-01-01",
        description: "Old description",
        notes: "Old notes",
        status: "open",
        tags: ["old"],
        linkedRecordIds: ["inc-1"],
        createdAt: "2024-01-01T09:00:00.000Z",
        updatedAt: "2024-01-01T09:00:00.000Z",
      },
    ],
    incidents: [
      {
        id: "inc-1",
        type: "incidents",
        title: "Incident",
        date: "2024-01-01",
        description: "Old incident description",
        notes: "",
        attachments: [],
        availability: {
          physical: { hasOriginal: false, location: "", notes: "" },
          digital: { hasDigital: false, files: [] },
        },
        tags: ["old-incident"],
        linkedEvidenceIds: [],
        linkedRecordIds: [],
        createdAt: "2024-01-01T08:00:00.000Z",
        updatedAt: "2024-01-01T08:00:00.000Z",
      },
    ],
    evidence: [
      {
        id: "ev-1",
        type: "evidence",
        title: "Evidence",
        date: "2024-01-02",
        description: "Old evidence description",
        notes: "",
        attachments: [],
        linkedIncidentIds: [],
        linkedRecordIds: [],
        linkedEvidenceIds: [],
        availability: {
          physical: { hasOriginal: false, location: "", notes: "" },
          digital: { hasDigital: false, files: [] },
        },
        createdAt: "2024-01-02T08:00:00.000Z",
        updatedAt: "2024-01-02T08:00:00.000Z",
      },
    ],
    documents: [
      {
        id: "doc-1",
        title: "Document",
        category: "other",
        textContent: "Old document text",
        linkedRecordIds: [],
        attachments: [],
        createdAt: "2024-01-03T08:00:00.000Z",
        updatedAt: "2024-01-03T08:00:00.000Z",
      },
    ],
    ledger: [
      {
        id: "ledger-1",
        label: "Ledger",
        category: "other",
        expectedAmount: 100,
        paidAmount: 25,
        linkedRecordIds: [],
        createdAt: "2024-01-04T08:00:00.000Z",
        updatedAt: "2024-01-04T08:00:00.000Z",
      },
    ],
  };
}

function delta(patch, overrides = {}) {
  return {
    app: "proveit",
    contractVersion: "gpt-delta-1.0",
    target: { caseId: "case-1" },
    operations: { patch },
    ...overrides,
  };
}

test("ingestGptDelta rejects non-object payload", () => {
  assert.deepEqual(
    ingestGptDelta(baseCase(), null),
    { ok: false, reason: "GPT delta requires a case and payload object." }
  );
});

test("ingestGptDelta rejects wrong app", () => {
  const result = ingestGptDelta(baseCase(), delta({}, { app: "other" }));

  assert.deepEqual(result, { ok: false, reason: "Unsupported GPT delta contract." });
});

test("ingestGptDelta rejects wrong contractVersion", () => {
  const result = ingestGptDelta(baseCase(), delta({}, { contractVersion: "gpt-delta-3.0" }));

  assert.deepEqual(result, { ok: false, reason: "Unsupported GPT delta contract." });
});

test("ingestGptDelta gpt-delta-2.0 creates an incident", () => {
  const result = ingestGptDelta(baseCase(), {
    app: "proveit",
    contractVersion: "gpt-delta-2.0",
    target: { caseId: "case-1" },
    operations: {
      create: {
        incidents: [
          {
            tempId: "tmp-inc",
            title: "New incident",
            date: "2024-03-01",
            description: "Created by GPT",
            evidenceStatus: "needs_evidence",
            isMilestone: true,
            sequenceGroup: "Notice sequence",
            tags: ["notice"],
            linkedRecordIds: ["str-1"],
          },
        ],
      },
    },
  });

  assert.equal(result.ok, true);
  const created = result.case.incidents.find((item) => item.title === "New incident");
  assert.ok(created.id);
  assert.notEqual(created.id, "tmp-inc");
  assert.equal(created.isMilestone, true);
  assert.equal(created.sequenceGroup, "Notice sequence");
  assert.deepEqual(created.tags, ["notice"]);
  assert.deepEqual(created.linkedRecordIds, ["str-1"]);
  assert.deepEqual(result.tempIdMappings, [{ tempId: "tmp-inc", finalId: created.id }]);
  assert.deepEqual(result.createdRecords[0], {
    id: created.id,
    tempId: "tmp-inc",
    recordType: "incident",
    title: "New incident",
    links: { linkedRecordIds: ["str-1"] },
  });
});

test("ingestGptDelta routes trimmed gpt-delta-2.0 contract to create handler", () => {
  const result = ingestGptDelta(baseCase(), {
    app: " proveit ",
    contractVersion: " gpt-delta-2.0 ",
    target: { caseId: "case-1" },
    operations: {
      create: {
        incidents: [{ title: "Whitespace contract incident" }],
      },
    },
  });

  assert.equal(result.ok, true);
  assert.equal(
    result.case.incidents.some((item) => item.title === "Whitespace contract incident"),
    true
  );
});

test("ingestGptDelta gpt-delta-2.0 creates evidence", () => {
  const result = ingestGptDelta(baseCase(), {
    app: "proveit",
    contractVersion: "gpt-delta-2.0",
    target: { caseId: "case-1" },
    operations: {
      create: {
        evidence: [
          {
            tempId: "tmp-ev",
            title: "New evidence",
            date: "2024-03-02",
            functionSummary: "Shows the incident was reported.",
            evidenceRole: "COMMUNICATION_EVIDENCE",
            evidenceType: "documented",
            linkedIncidentIds: ["inc-1"],
          },
        ],
      },
    },
  });

  assert.equal(result.ok, true);
  const created = result.case.evidence.find((item) => item.title === "New evidence");
  assert.ok(created.id);
  assert.notEqual(created.id, "tmp-ev");
  assert.equal(created.functionSummary, "Shows the incident was reported.");
  assert.equal(created.evidenceRole, "COMMUNICATION_EVIDENCE");
  assert.deepEqual(created.linkedIncidentIds, ["inc-1"]);
  assert.deepEqual(created.attachments, []);
  assert.deepEqual(result.case.incidents.find((item) => item.id === "inc-1").linkedEvidenceIds, [created.id]);
});

test("ingestGptDelta gpt-delta-2.0 warns when creating an incident with exact title and date match", () => {
  const result = ingestGptDelta(baseCase(), {
    app: "proveit",
    contractVersion: "gpt-delta-2.0",
    target: { caseId: "case-1" },
    operations: {
      create: {
        incidents: [
          {
            tempId: "tmp-inc",
            title: "Incident",
            date: "2024-01-01",
            description: "Still allowed, but should warn.",
          },
        ],
      },
    },
  });

  assert.equal(result.ok, true);
  assert.equal(
    result.case.incidents.some((item) => item.title === "Incident" && item.id !== "inc-1"),
    true
  );
  assert.deepEqual(result.warnings, [
    "Possible duplicate incident create: 'Incident' matches existing incident 'Incident' on 2024-01-01 (id: inc-1). Consider patching the existing record instead.",
  ]);

  const preview = buildGptDeltaPreview({
    app: "proveit",
    contractVersion: "gpt-delta-2.0",
    target: { caseId: "case-1" },
    operations: {
      create: {
        incidents: [{ tempId: "tmp-inc", title: "Incident", date: "2024-01-01" }],
      },
    },
  }, baseCase(), result.case, result);

  assert.deepEqual(preview.warnings, result.warnings);
});

test("ingestGptDelta gpt-delta-2.0 warns when creating evidence with exact title and date match", () => {
  const result = ingestGptDelta(baseCase(), {
    app: "proveit",
    contractVersion: "gpt-delta-2.0",
    target: { caseId: "case-1" },
    operations: {
      create: {
        evidence: [
          {
            tempId: "tmp-ev",
            title: "Evidence",
            date: "2024-01-02",
            functionSummary: "Still allowed, but should warn.",
          },
        ],
      },
    },
  });

  assert.equal(result.ok, true);
  assert.equal(
    result.case.evidence.some((item) => item.title === "Evidence" && item.id !== "ev-1"),
    true
  );
  assert.deepEqual(result.warnings, [
    "Possible duplicate evidence create: 'Evidence' matches existing evidence 'Evidence' on 2024-01-02 (id: ev-1). Consider patching the existing record instead.",
  ]);
});

test("ingestGptDelta gpt-delta-2.0 warns when creating an incident with similar title and same date", () => {
  const currentCase = {
    ...baseCase(),
    incidents: [
      {
        ...baseCase().incidents[0],
        id: "inc-formal",
        title: "Formal wellbeing deterioration notification sent to Consul General",
        date: "2026-05-15",
      },
    ],
  };

  const result = ingestGptDelta(currentCase, {
    app: "proveit",
    contractVersion: "gpt-delta-2.0",
    target: { caseId: "case-1" },
    operations: {
      create: {
        incidents: [
          {
            tempId: "tmp-inc",
            title: "Formal wellbeing deterioration notice sent to Consul General",
            eventDate: "2026-05-15",
          },
        ],
      },
    },
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.warnings, [
    "Possible duplicate incident create: 'Formal wellbeing deterioration notice sent to Consul General' matches existing incident 'Formal wellbeing deterioration notification sent to Consul General' on 2026-05-15 (id: inc-formal). Consider patching the existing record instead.",
  ]);
});

test("ingestGptDelta gpt-delta-2.0 creates documents and ledger entries", () => {
  const result = ingestGptDelta(baseCase(), {
    app: "proveit",
    contractVersion: "gpt-delta-2.0",
    target: { caseId: "case-1" },
    operations: {
      create: {
        documents: [
          {
            tempId: "tmp-doc",
            title: "New document",
            category: "correspondence",
            textContent: "Plain source text",
            linkedRecordIds: ["inc-1"],
          },
        ],
        ledger: [
          {
            tempId: "tmp-ledger",
            label: "March rent",
            category: "rent",
            expectedAmount: 1000,
            paidAmount: 700,
            linkedRecordIds: ["tmp-doc"],
          },
        ],
      },
    },
  });

  assert.equal(result.ok, true);
  const document = result.case.documents.find((item) => item.title === "New document");
  const ledger = result.case.ledger.find((item) => item.label === "March rent");
  assert.ok(document.id);
  assert.ok(ledger.id);
  assert.deepEqual(document.attachments, []);
  assert.deepEqual(document.linkedRecordIds, ["inc-1"]);
  assert.deepEqual(ledger.linkedRecordIds, [document.id]);
  assert.equal(ledger.differenceAmount, 300);
});

test("ingestGptDelta gpt-delta-2.0 resolves temp ID links between new incident and evidence", () => {
  const result = ingestGptDelta(baseCase(), {
    app: "proveit",
    contractVersion: "gpt-delta-2.0",
    target: { caseId: "case-1" },
    operations: {
      create: {
        incidents: [
          { tempId: "tmp-inc", title: "Linked incident", linkedEvidenceIds: ["tmp-ev"] },
        ],
        evidence: [
          { tempId: "tmp-ev", title: "Linked evidence", linkedIncidentIds: ["tmp-inc"] },
        ],
      },
    },
  });

  assert.equal(result.ok, true);
  const incidentId = result.tempIdMappings.find((item) => item.tempId === "tmp-inc").finalId;
  const evidenceId = result.tempIdMappings.find((item) => item.tempId === "tmp-ev").finalId;
  const incident = result.case.incidents.find((item) => item.id === incidentId);
  const evidence = result.case.evidence.find((item) => item.id === evidenceId);
  assert.deepEqual(incident.linkedEvidenceIds, [evidenceId]);
  assert.deepEqual(evidence.linkedIncidentIds, [incidentId]);
});

test("ingestGptDelta gpt-delta-2.0 rejects invalid links unknown fields and binary attachment creation", () => {
  assert.deepEqual(
    ingestGptDelta(baseCase(), {
      app: "proveit",
      contractVersion: "gpt-delta-2.0",
      target: { caseId: "case-1" },
      operations: { create: { evidence: [{ title: "Evidence", linkedIncidentIds: ["missing"] }] } },
    }),
    { ok: false, reason: "evidence.create Evidence has unknown linkedIncidentIds: missing." }
  );

  assert.deepEqual(
    ingestGptDelta(baseCase(), {
      app: "proveit",
      contractVersion: "gpt-delta-2.0",
      target: { caseId: "case-1" },
      operations: { create: { evidence: [{ title: "Evidence", linkedIncidentIds: ["str-1"] }] } },
    }),
    { ok: false, reason: "evidence.create Evidence has unknown linkedIncidentIds: str-1." }
  );

  assert.deepEqual(
    ingestGptDelta(baseCase(), {
      app: "proveit",
      contractVersion: "gpt-delta-2.0",
      target: { caseId: "case-1" },
      operations: { create: { incidents: [{ title: "Incident", sequenceGroup: "Allowed", unsupported: true }] } },
    }),
    { ok: false, reason: "incidents.create has unsupported field(s): unsupported." }
  );

  assert.deepEqual(
    ingestGptDelta(baseCase(), {
      app: "proveit",
      contractVersion: "gpt-delta-2.0",
      target: { caseId: "case-1" },
      operations: { create: { documents: [{ title: "Document", attachments: [{ name: "file.pdf" }] }] } },
    }),
    { ok: false, reason: "documents.create does not support binary or attachment field(s): attachments." }
  );
});

test("ingestGptDelta gpt-delta-2.0 patches incidents and syncs evidence links", () => {
  const result = ingestGptDelta(baseCase(), {
    app: "proveit",
    contractVersion: "gpt-delta-2.0",
    target: { caseId: "case-1" },
    operations: {
      patch: {
        incidents: [
          {
            id: "inc-1",
            patch: {
              title: "Updated incident",
              evidenceStatus: "supported",
              isMilestone: true,
              tags: ["updated", "incident"],
              linkedEvidenceIds: ["ev-1"],
            },
          },
        ],
      },
    },
  });

  assert.equal(result.ok, true);
  const incident = result.case.incidents.find((item) => item.id === "inc-1");
  assert.equal(incident.title, "Updated incident");
  assert.equal(incident.createdAt, "2024-01-01T08:00:00.000Z");
  assert.match(incident.updatedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.deepEqual(incident.tags, ["updated", "incident"]);
  assert.deepEqual(incident.linkedEvidenceIds, ["ev-1"]);
  assert.deepEqual(result.case.evidence.find((item) => item.id === "ev-1").linkedIncidentIds, ["inc-1"]);
});

test("ingestGptDelta gpt-delta-2.0 patches evidence and syncs incident links", () => {
  const result = ingestGptDelta(baseCase(), {
    app: "proveit",
    contractVersion: "gpt-delta-2.0",
    target: { caseId: "case-1" },
    operations: {
      patch: {
        evidence: [
          {
            id: "ev-1",
            patch: {
              title: "Updated evidence",
              functionSummary: "Proves notice was sent.",
              evidenceRole: "COMMUNICATION_EVIDENCE",
              linkedIncidentIds: ["inc-1"],
            },
          },
        ],
      },
    },
  });

  assert.equal(result.ok, true);
  const evidence = result.case.evidence.find((item) => item.id === "ev-1");
  assert.equal(evidence.title, "Updated evidence");
  assert.equal(evidence.functionSummary, "Proves notice was sent.");
  assert.equal(evidence.evidenceRole, "COMMUNICATION_EVIDENCE");
  assert.equal(evidence.createdAt, "2024-01-02T08:00:00.000Z");
  assert.deepEqual(evidence.linkedIncidentIds, ["inc-1"]);
  assert.deepEqual(result.case.incidents.find((item) => item.id === "inc-1").linkedEvidenceIds, ["ev-1"]);
});

test("ingestGptDelta gpt-delta-2.0 patches documents and ledger entries", () => {
  const result = ingestGptDelta(baseCase(), {
    app: "proveit",
    contractVersion: "gpt-delta-2.0",
    target: { caseId: "case-1" },
    operations: {
      patch: {
        documents: [
          {
            id: "doc-1",
            patch: {
              title: "Updated document",
              textContent: "Replacement document text",
              linkedRecordIds: ["inc-1"],
            },
          },
        ],
        ledger: [
          {
            id: "ledger-1",
            patch: {
              label: "Updated ledger",
              paidAmount: 75,
              status: "part-paid",
              linkedRecordIds: ["doc-1"],
            },
          },
        ],
      },
    },
  });

  assert.equal(result.ok, true);
  const document = result.case.documents.find((item) => item.id === "doc-1");
  const ledger = result.case.ledger.find((item) => item.id === "ledger-1");
  assert.equal(document.title, "Updated document");
  assert.equal(document.textContent, "Replacement document text");
  assert.equal(document.createdAt, "2024-01-03T08:00:00.000Z");
  assert.deepEqual(document.linkedRecordIds, ["inc-1"]);
  assert.equal(ledger.label, "Updated ledger");
  assert.equal(ledger.paidAmount, 75);
  assert.equal(ledger.differenceAmount, 25);
  assert.equal(ledger.createdAt, "2024-01-04T08:00:00.000Z");
  assert.deepEqual(ledger.linkedRecordIds, ["doc-1"]);
});

test("ingestGptDelta gpt-delta-2.0 patches strategy with sequenceGroup and typed links", () => {
  const result = ingestGptDelta(baseCase(), {
    app: "proveit",
    contractVersion: "gpt-delta-2.0",
    target: { caseId: "case-1" },
    operations: {
      patch: {
        strategy: [
          {
            id: "str-1",
            patch: {
              title: "Updated strategy",
              sequenceGroup: "Notice sequence",
              source: "gpt",
              linkedRecordIds: ["inc-1"],
              linkedIncidentIds: ["inc-1"],
              linkedEvidenceIds: ["ev-1"],
            },
          },
        ],
      },
    },
  });

  assert.equal(result.ok, true);
  const strategy = result.case.strategy.find((item) => item.id === "str-1");
  assert.equal(strategy.title, "Updated strategy");
  assert.equal(strategy.sequenceGroup, "Notice sequence");
  assert.equal(strategy.source, "gpt");
  assert.deepEqual(strategy.linkedIncidentIds, ["inc-1"]);
  assert.deepEqual(strategy.linkedEvidenceIds, ["ev-1"]);
});

test("ingestGptDelta gpt-delta-2.0 rejects unsafe record patches", () => {
  assert.deepEqual(
    ingestGptDelta(baseCase(), {
      app: "proveit",
      contractVersion: "gpt-delta-2.0",
      target: { caseId: "case-1" },
      operations: { patch: { incidents: [{ id: "missing", patch: { title: "Nope" } }] } },
    }),
    { ok: false, reason: "incidents.patch references unknown record id: missing." }
  );

  assert.deepEqual(
    ingestGptDelta(baseCase(), {
      app: "proveit",
      contractVersion: "gpt-delta-2.0",
      target: { caseId: "case-1" },
      operations: { patch: { incidents: [{ id: "inc-1", patch: { unsupported: true } }] } },
    }),
    { ok: false, reason: "incidents.patch inc-1 has unsupported field(s): unsupported." }
  );

  assert.deepEqual(
    ingestGptDelta(baseCase(), {
      app: "proveit",
      contractVersion: "gpt-delta-2.0",
      target: { caseId: "case-1" },
      operations: { patch: { evidence: [{ id: "ev-1", patch: { linkedIncidentIds: ["missing"] } }] } },
    }),
    { ok: false, reason: "evidence.patch ev-1 has unknown linkedIncidentIds: missing." }
  );

  assert.deepEqual(
    ingestGptDelta(baseCase(), {
      app: "proveit",
      contractVersion: "gpt-delta-2.0",
      target: { caseId: "case-1" },
      operations: { patch: { documents: [{ id: "doc-1", patch: { attachments: [] } }] } },
    }),
    { ok: false, reason: "documents.patch doc-1 does not support binary or attachment field(s): attachments." }
  );
});

test("ingestGptDelta gpt-delta-2.0 rejects actionSummary patches and strategy creates", () => {
  assert.deepEqual(
    ingestGptDelta(baseCase(), {
      app: "proveit",
      contractVersion: "gpt-delta-2.0",
      target: { caseId: "case-1" },
      operations: { patch: { actionSummary: { currentFocus: "Nope" } } },
    }),
    {
      ok: false,
      reason: "Unsupported gpt-delta-2.0 patch section(s): actionSummary. Current patch support is incidents, evidence, documents, ledger, and strategy.",
    }
  );

  assert.deepEqual(
    ingestGptDelta(baseCase(), {
      app: "proveit",
      contractVersion: "gpt-delta-2.0",
      target: { caseId: "case-1" },
      operations: { create: { strategy: [{ tempId: "tmp-str", title: "Nope" }] } },
    }),
    {
      ok: false,
      reason: "Unsupported gpt-delta-2.0 create section(s): strategy. Current create support is incidents, evidence, documents, and ledger.",
    }
  );
});

test("buildGptDeltaPreview shows gpt-delta-2.0 array replacement record patches", () => {
  const currentCase = baseCase();
  const result = ingestGptDelta(currentCase, {
    app: "proveit",
    contractVersion: "gpt-delta-2.0",
    target: { caseId: "case-1" },
    operations: {
      patch: {
        incidents: [
          { id: "inc-1", patch: { tags: ["after"], linkedEvidenceIds: ["ev-1"] } },
        ],
      },
    },
  });

  assert.equal(result.ok, true);
  const preview = buildGptDeltaPreview({
    app: "proveit",
    contractVersion: "gpt-delta-2.0",
    target: { caseId: "case-1" },
    operations: {
      patch: {
        incidents: [
          { id: "inc-1", patch: { tags: ["after"], linkedEvidenceIds: ["ev-1"] } },
        ],
      },
    },
  }, currentCase, result.case, result);

  assert.deepEqual(preview.supportedSections, ["incidents.patch"]);
  assert.deepEqual(preview.patchedRecords[0].changes, [
    { field: "tags", before: "old-incident", after: "after" },
    { field: "linkedEvidenceIds", before: "", after: "ev-1" },
  ]);
});

test("ingestGptDelta rejects missing and mismatched target.caseId", () => {
  assert.deepEqual(
    ingestGptDelta(baseCase(), delta({}, { target: {} })),
    { ok: false, reason: "GPT delta target.caseId is required." }
  );

  assert.deepEqual(
    ingestGptDelta(baseCase(), delta({}, { target: { caseId: "case-2" } })),
    { ok: false, reason: "GPT delta target case does not match the provided case." }
  );
});

test("ingestGptDelta actionSummary patch applies only supported fields", () => {
  const result = ingestGptDelta(baseCase(), delta({
    actionSummary: {
      currentFocus: "New focus",
      nextActions: ["New action"],
      importantReminders: ["New reminder"],
      strategyFocus: ["New strategy"],
      criticalDeadlines: ["New deadline"],
      unsupportedField: "ignored",
    },
  }));

  assert.equal(result.ok, true);
  assert.deepEqual(result.warnings, ["actionSummary has unsupported field(s) for gpt-delta-1.0: unsupportedField."]);
  assert.equal(result.case.actionSummary.currentFocus, "New focus");
  assert.deepEqual(result.case.actionSummary.nextActions, ["New action"]);
  assert.deepEqual(result.case.actionSummary.importantReminders, ["New reminder"]);
  assert.deepEqual(result.case.actionSummary.strategyFocus, ["New strategy"]);
  assert.deepEqual(result.case.actionSummary.criticalDeadlines, ["New deadline"]);
  assert.equal(Object.hasOwn(result.case.actionSummary, "unsupportedField"), false);
  assert.match(result.case.actionSummary.updatedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.match(result.case.updatedAt, /^\d{4}-\d{2}-\d{2}T/);
});

test("ingestGptDelta strategy patch applies only supported fields", () => {
  const result = ingestGptDelta(baseCase(), delta({
    strategy: [
      {
        id: "str-1",
        patch: {
          title: "New strategy record",
          date: "2024-02-01",
          description: "New description",
          notes: "New notes",
          status: "archived",
          tags: ["new"],
          linkedRecordIds: ["inc-1"],
          linkedEvidenceIds: ["ignored"],
          unsupportedField: "ignored",
        },
      },
    ],
  }));

  assert.equal(result.ok, true);
  assert.deepEqual(result.warnings, ["Strategy str-1 has unsupported field(s) for gpt-delta-1.0: linkedEvidenceIds, unsupportedField."]);
  const updated = result.case.strategy[0];
  assert.equal(updated.title, "New strategy record");
  assert.equal(updated.date, "2024-02-01");
  assert.equal(updated.eventDate, "2024-02-01");
  assert.equal(updated.description, "New description");
  assert.equal(updated.notes, "New notes");
  assert.equal(updated.status, "archived");
  assert.deepEqual(updated.tags, ["new"]);
  assert.deepEqual(updated.linkedRecordIds, ["inc-1"]);
  assert.deepEqual(updated.linkedEvidenceIds, []);
  assert.equal(Object.hasOwn(updated, "unsupportedField"), false);
  assert.match(updated.updatedAt, /^\d{4}-\d{2}-\d{2}T/);
});

test("ingestGptDelta unsupported patch sections return clear rejection behavior", () => {
  assert.deepEqual(
    ingestGptDelta(baseCase(), delta({ incidents: [{ id: "inc-1", patch: { title: "Ignored" } }] })),
    {
      ok: false,
      reason: "Unsupported gpt-delta-1.0 patch section(s): incidents. Current importer supports only actionSummary and strategy patches.",
    }
  );
});

test("ingestGptDelta detects duplicate strategy patch ids", () => {
  assert.deepEqual(
    ingestGptDelta(baseCase(), delta({
      strategy: [
        { id: "str-1", patch: { title: "First" } },
        { id: "str-1", patch: { title: "Second" } },
      ],
    })),
    { ok: false, reason: "Duplicate strategy patch id: str-1" }
  );
});

test("ingestGptDelta reports duplicate actionSummary list entries as warnings", () => {
  const result = ingestGptDelta(baseCase(), delta({
    actionSummary: {
      nextActions: ["Call office", "call office", "Send email"],
      importantReminders: ["Keep receipt", "Keep receipt"],
      strategyFocus: ["Proof", "proof"],
      criticalDeadlines: ["2024-01-10", "2024-01-10"],
    },
  }));

  assert.equal(result.ok, true);
  assert.deepEqual(result.warnings, [
    "actionSummary.nextActions contains duplicate item(s): call office.",
    "actionSummary.importantReminders contains duplicate item(s): Keep receipt.",
    "actionSummary.strategyFocus contains duplicate item(s): proof.",
    "actionSummary.criticalDeadlines contains duplicate item(s): 2024-01-10.",
  ]);
});

test("ingestGptDelta rejects unknown strategy linkedRecordIds", () => {
  assert.deepEqual(
    ingestGptDelta(baseCase(), delta({
      strategy: [
        { id: "str-1", patch: { linkedRecordIds: ["inc-1", "missing-record"] } },
      ],
    })),
    { ok: false, reason: "Strategy str-1 has unknown linkedRecordIds: missing-record." }
  );
});

test("ingestGptDelta reports unsupported strategy fields without applying them", () => {
  const result = ingestGptDelta(baseCase(), delta({
    strategy: [
      { id: "str-1", patch: { title: "Updated", sequenceGroup: "Unsupported sequence" } },
    ],
  }));

  assert.equal(result.ok, true);
  assert.deepEqual(result.warnings, ["Strategy str-1 has unsupported field(s) for gpt-delta-1.0: sequenceGroup."]);
  assert.equal(result.case.strategy[0].title, "Updated");
  assert.equal(result.case.strategy[0].sequenceGroup, "");
});

test("buildGptDeltaPreview returns expected core preview shape", () => {
  const currentCase = baseCase();
  const updatedCase = {
    ...currentCase,
    actionSummary: {
      ...currentCase.actionSummary,
      currentFocus: "New focus",
      nextActions: ["New action"],
    },
    strategy: [{ ...currentCase.strategy[0], title: "Updated preview title" }],
  };
  const payload = delta({
    actionSummary: {
      currentFocus: "New focus",
      nextActions: ["New action"],
      ignored: "ignored",
    },
    strategy: [
      { id: "str-1", patch: { title: "Updated preview title" } },
      { id: "", patch: { title: "Ignored blank id" } },
    ],
  });

  assert.deepEqual(buildGptDeltaPreview(payload, currentCase, updatedCase, ["Warning"]), {
    caseName: "Case One",
    caseId: "case-1",
    contractVersion: "gpt-delta-1.0",
    supportedSections: ["Action Summary", "Strategy"],
    actionSummaryFields: ["currentFocus", "nextActions"],
    actionSummaryChanges: [
      { field: "currentFocus", before: "Old focus", after: "New focus" },
      { field: "nextActions", before: "Old action", after: "New action" },
    ],
    strategyItems: [
      {
        id: "str-1",
        title: "Updated preview title",
        changes: [
          { field: "title", before: "Old strategy record", after: "Updated preview title" },
        ],
      },
    ],
    patchedRecords: [],
    createdRecords: [],
    tempIdMappings: [],
    warnings: ["Warning"],
  });
});

test("buildGptDeltaPreview includes gpt-delta-2.0 created records and temp ID mappings", () => {
  const currentCase = baseCase();
  const updatedCase = {
    ...currentCase,
    incidents: [
      ...currentCase.incidents,
      { id: "inc-new", title: "New incident" },
    ],
  };
  const payload = {
    app: "proveit",
    contractVersion: "gpt-delta-2.0",
    target: { caseId: "case-1" },
    operations: {
      create: {
        incidents: [{ tempId: "tmp-inc", title: "New incident" }],
      },
    },
  };

  assert.deepEqual(buildGptDeltaPreview(payload, currentCase, updatedCase, {
    createdRecords: [
      { id: "inc-new", tempId: "tmp-inc", recordType: "incident", title: "New incident", links: {} },
    ],
    tempIdMappings: [{ tempId: "tmp-inc", finalId: "inc-new" }],
    warnings: [],
  }), {
    caseName: "Case One",
    caseId: "case-1",
    contractVersion: "gpt-delta-2.0",
    supportedSections: ["incidents.create"],
    actionSummaryFields: [],
    actionSummaryChanges: [],
    strategyItems: [],
    patchedRecords: [],
    createdRecords: [
      { id: "inc-new", tempId: "tmp-inc", recordType: "incident", title: "New incident", links: {} },
    ],
    tempIdMappings: [{ tempId: "tmp-inc", finalId: "inc-new" }],
    warnings: [],
  });
});

test("prepareGptDeltaPayloadForSelectedCase fills missing blank and AUTO target.caseId with selectedCaseId", () => {
  assert.deepEqual(
    prepareGptDeltaPayloadForSelectedCase({ app: "proveit" }, "selected-1"),
    { app: "proveit", target: { caseId: "selected-1" } }
  );

  assert.deepEqual(
    prepareGptDeltaPayloadForSelectedCase({ app: "proveit", target: { caseId: "" } }, "selected-1"),
    { app: "proveit", target: { caseId: "selected-1" } }
  );

  assert.deepEqual(
    prepareGptDeltaPayloadForSelectedCase({ app: "proveit", target: { caseId: "AUTO" } }, "selected-1"),
    { app: "proveit", target: { caseId: "selected-1" } }
  );
});
