import test from "node:test";
import assert from "node:assert/strict";

import { removeRecordAttachmentFromForm } from "./recordFormDomain.js";

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
