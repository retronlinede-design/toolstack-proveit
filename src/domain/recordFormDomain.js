const DEFAULT_RECORD_FORM_AVAILABILITY = {
  physical: { hasOriginal: false, location: "", notes: "" },
  digital: { hasDigital: false, files: [] },
};

export function removeRecordAttachmentFromForm(recordForm, recordType, attachmentId, options = {}) {
  const {
    allowLastEvidenceAttachmentRemoval = true,
    emptyAvailability = DEFAULT_RECORD_FORM_AVAILABILITY,
  } = options;

  const updatedAttachments = recordForm.attachments.filter((file) => file.id !== attachmentId);

  if (
    recordType === "evidence" &&
    updatedAttachments.length === 0 &&
    recordForm.availability?.digital?.hasDigital &&
    !allowLastEvidenceAttachmentRemoval
  ) {
    return recordForm;
  }

  const newState = { ...recordForm, attachments: updatedAttachments };

  if (recordType === "evidence") {
    newState.availability = {
      ...(recordForm.availability || emptyAvailability),
      digital: {
        ...(recordForm.availability?.digital || emptyAvailability.digital),
        files: updatedAttachments,
        hasDigital: updatedAttachments.length > 0,
      },
    };
  }

  return newState;
}
