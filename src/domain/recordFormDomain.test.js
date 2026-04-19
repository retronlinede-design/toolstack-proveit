import test from "node:test";
import assert from "node:assert/strict";

import {
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
