import test from "node:test";
import assert from "node:assert/strict";

import {
  normalizeStrategyStringList,
  prepareRecordFormForSave,
  removeRecordAttachmentFromForm,
  suggestEvidenceMetadataForForm,
} from "./recordFormDomain.js";

const emptyAvailability = {
  physical: { hasOriginal: false, location: "", notes: "" },
  digital: { hasDigital: false, files: [] },
};

test("evidence with multiple attachments removes one and keeps hasDigital true", () => {
  const fileA = { id: "file-a", name: "A.png" };
  const fileB = { id: "file-b", name: "B.png" };
  const form = {
    title: "Evidence",
    attachments: [fileA, fileB],
    availability: {
      physical: { hasOriginal: true, location: "box", notes: "original" },
      digital: { hasDigital: true, files: [fileA, fileB], notes: "digital notes" },
    },
  };

  const updated = removeRecordAttachmentFromForm(form, "evidence", "file-a", { emptyAvailability });

  assert.deepEqual(updated.attachments, [fileB]);
  assert.deepEqual(updated.availability.digital.files, [fileB]);
  assert.equal(updated.availability.digital.hasDigital, true);
  assert.equal(updated.availability.digital.notes, "digital notes");
  assert.deepEqual(updated.availability.physical, form.availability.physical);
});

test("evidence last attachment plus cancel leaves state unchanged", () => {
  const file = { id: "file-a", name: "A.png" };
  const form = {
    title: "Evidence",
    attachments: [file],
    availability: {
      physical: { hasOriginal: false, location: "", notes: "" },
      digital: { hasDigital: true, files: [file] },
    },
  };

  const updated = removeRecordAttachmentFromForm(form, "evidence", "file-a", {
    allowLastEvidenceAttachmentRemoval: false,
    emptyAvailability,
  });

  assert.equal(updated, form);
  assert.deepEqual(updated.attachments, [file]);
  assert.deepEqual(updated.availability.digital.files, [file]);
  assert.equal(updated.availability.digital.hasDigital, true);
});

test("evidence last attachment plus confirm clears files and sets hasDigital false", () => {
  const file = { id: "file-a", name: "A.png" };
  const form = {
    title: "Evidence",
    attachments: [file],
    availability: {
      physical: { hasOriginal: false, location: "", notes: "" },
      digital: { hasDigital: true, files: [file] },
    },
  };

  const updated = removeRecordAttachmentFromForm(form, "evidence", "file-a", {
    allowLastEvidenceAttachmentRemoval: true,
    emptyAvailability,
  });

  assert.deepEqual(updated.attachments, []);
  assert.deepEqual(updated.availability.digital.files, []);
  assert.equal(updated.availability.digital.hasDigital, false);
});

test("non-evidence attachment removal only updates attachments", () => {
  const fileA = { id: "file-a", name: "A.png" };
  const fileB = { id: "file-b", name: "B.png" };
  const availability = {
    digital: { hasDigital: true, files: [fileA, fileB] },
  };
  const form = {
    title: "Incident",
    attachments: [fileA, fileB],
    availability,
  };

  const updated = removeRecordAttachmentFromForm(form, "incidents", "file-a", { emptyAvailability });

  assert.deepEqual(updated.attachments, [fileB]);
  assert.equal(updated.availability, availability);
});

test("prepareRecordFormForSave aligns hidden incident eventDate with visible modal date", () => {
  const form = {
    id: "inc-1",
    title: "Incident",
    date: "2024-04-12",
    eventDate: "2024-04-01",
  };

  const prepared = prepareRecordFormForSave(form, "incidents");

  assert.equal(prepared.date, "2024-04-12");
  assert.equal(prepared.eventDate, "2024-04-12");
});

test("prepareRecordFormForSave aligns hidden evidence eventDate with visible modal date", () => {
  const form = {
    id: "ev-1",
    title: "Evidence",
    date: "2024-04-12",
    eventDate: "2024-04-01",
    capturedAt: "2024-04-13",
  };

  const prepared = prepareRecordFormForSave(form, "evidence");

  assert.equal(prepared.date, "2024-04-12");
  assert.equal(prepared.eventDate, "2024-04-12");
  assert.equal(prepared.capturedAt, "2024-04-13");
});

test("prepareRecordFormForSave aligns hidden strategy eventDate with visible modal date", () => {
  const form = {
    id: "str-1",
    title: "Strategy",
    date: "2024-04-12",
    eventDate: "2024-04-01",
  };

  const prepared = prepareRecordFormForSave(form, "strategy");

  assert.equal(prepared.date, "2024-04-12");
  assert.equal(prepared.eventDate, "2024-04-12");
});

test("normalizeStrategyStringList trims entries, drops blanks, and preserves order", () => {
  assert.deepEqual(normalizeStrategyStringList(["  First  ", "", "  ", "Second", null, "First"]), [
    "First",
    "Second",
    "First",
  ]);
});

test("prepareRecordFormForSave preserves structured strategy fields, links, and attachments", () => {
  const attachment = { id: "att-1", name: "plan.pdf" };
  const prepared = prepareRecordFormForSave({
    id: "str-1",
    title: "Negotiation plan",
    date: "2026-07-20",
    strategyType: "negotiation",
    objective: "Reach agreement",
    rationale: "Avoid delay",
    desiredOutcome: "Signed terms",
    priority: "high",
    reviewDate: "2026-08-01",
    decisionStatus: "approved",
    ownerPartyId: "party-1",
    assumptions: ["  Offer remains open  "],
    risks: [" Terms may change "],
    nextSteps: [" Draft response ", ""],
    description: "Legacy description",
    notes: "Legacy notes",
    attachments: [attachment],
    linkedRecordIds: ["inc-1"],
  }, "strategy", [{ id: "party-1" }]);

  assert.equal(prepared.eventDate, "2026-07-20");
  assert.equal(prepared.strategyType, "negotiation");
  assert.equal(prepared.objective, "Reach agreement");
  assert.equal(prepared.rationale, "Avoid delay");
  assert.equal(prepared.desiredOutcome, "Signed terms");
  assert.equal(prepared.priority, "high");
  assert.equal(prepared.reviewDate, "2026-08-01");
  assert.equal(prepared.decisionStatus, "approved");
  assert.equal(prepared.ownerPartyId, "party-1");
  assert.deepEqual(prepared.assumptions, ["Offer remains open"]);
  assert.deepEqual(prepared.risks, ["Terms may change"]);
  assert.deepEqual(prepared.nextSteps, ["Draft response"]);
  assert.equal(prepared.description, "Legacy description");
  assert.equal(prepared.notes, "Legacy notes");
  assert.deepEqual(prepared.attachments, [attachment]);
  assert.deepEqual(prepared.linkedRecordIds, ["inc-1"]);
});

test("prepareRecordFormForSave resaves legacy strategy text without deriving structured fields", () => {
  const prepared = prepareRecordFormForSave({
    id: "str-legacy",
    title: "Legacy strategy",
    date: "2024-01-10",
    description: "Keep this description",
    notes: "Keep these notes",
  }, "strategy", []);

  assert.equal(prepared.description, "Keep this description");
  assert.equal(prepared.notes, "Keep these notes");
  assert.deepEqual(prepared.assumptions, []);
  assert.deepEqual(prepared.risks, []);
  assert.deepEqual(prepared.nextSteps, []);
  assert.equal(prepared.objective, undefined);
});

test("prepareRecordFormForSave clears an owner that is not an existing case party", () => {
  const prepared = prepareRecordFormForSave({ title: "Plan", ownerPartyId: "missing-party" }, "strategy", [
    { id: "party-1" },
  ]);

  assert.equal(prepared.ownerPartyId, "");
});

test("prepareRecordFormForSave does not apply strategy list or owner handling to other forms", () => {
  const incident = { title: "Incident", date: "2026-07-20", assumptions: ["  untouched  "], ownerPartyId: "missing" };
  const evidence = { title: "Evidence", date: "2026-07-20", risks: ["  untouched  "] };

  assert.deepEqual(prepareRecordFormForSave(incident, "incidents", []), { ...incident, eventDate: "2026-07-20" });
  assert.deepEqual(prepareRecordFormForSave(evidence, "evidence", []), { ...evidence, eventDate: "2026-07-20" });
});

test("suggestEvidenceMetadataForForm biases image attachments toward visual corroboration", () => {
  const form = {
    title: "Kitchen mould photo",
    description: "Shows the wall condition",
    attachments: [{ id: "file-a", name: "mould-photo.jpg", mimeType: "image/jpeg" }],
  };

  const updated = suggestEvidenceMetadataForForm(form, { incidents: [] });

  assert.equal(updated.evidenceRole, "CORROBORATING_EVIDENCE");
  assert.equal(updated.sequenceGroup, "Visual condition record");
  assert.equal(updated.relevance, "medium");
  assert.equal(updated.importance, "supporting");
  assert.match(updated.functionSummary, /Visually documents/);
});

test("suggestEvidenceMetadataForForm biases financial wording toward anchor evidence", () => {
  const form = {
    title: "Bank transfer receipt",
    description: "Rent payment amount in euro",
    attachments: [{ id: "file-a", name: "receipt.pdf", mimeType: "application/pdf" }],
  };

  const updated = suggestEvidenceMetadataForForm(form, { incidents: [] });

  assert.equal(updated.evidenceRole, "ANCHOR_EVIDENCE");
  assert.equal(updated.sequenceGroup, "Payment / financial record");
  assert.equal(updated.relevance, "high");
  assert.equal(updated.importance, "strong");
  assert.match(updated.functionSummary, /payment/i);
});

test("suggestEvidenceMetadataForForm biases message wording toward communication evidence", () => {
  const form = {
    title: "WhatsApp reply from landlord",
    description: "Message confirming notice was received",
    attachments: [],
  };

  const updated = suggestEvidenceMetadataForForm(form, { incidents: [] });

  assert.equal(updated.evidenceRole, "COMMUNICATION_EVIDENCE");
  assert.equal(updated.sequenceGroup, "Communication / notice sequence");
  assert.equal(updated.relevance, "high");
  assert.equal(updated.importance, "strong");
  assert.match(updated.functionSummary, /communicated|noticed|replied/);
});

test("suggestEvidenceMetadataForForm uses linked incident context for sequence and summary", () => {
  const form = {
    title: "Invoice for repair",
    description: "Amount charged",
    linkedIncidentIds: ["inc-1"],
    attachments: [],
  };

  const updated = suggestEvidenceMetadataForForm(form, {
    incidents: [{ id: "inc-1", title: "Emergency repair dispute" }],
  });

  assert.equal(updated.evidenceRole, "ANCHOR_EVIDENCE");
  assert.equal(updated.sequenceGroup, "Emergency repair dispute");
  assert.match(updated.functionSummary, /Linked to incident: Emergency repair dispute/);
});

test("suggestEvidenceMetadataForForm keeps low-confidence suggestions conservative", () => {
  const form = {
    title: "Loose note",
    description: "Needs review",
    attachments: [],
  };

  const updated = suggestEvidenceMetadataForForm(form, { incidents: [] });

  assert.equal(updated.evidenceRole, "OTHER");
  assert.equal(updated.sequenceGroup, "Evidence review");
  assert.equal(updated.relevance, "medium");
  assert.equal(updated.importance, "supporting");
  assert.match(updated.functionSummary, /supporting context/i);
});
