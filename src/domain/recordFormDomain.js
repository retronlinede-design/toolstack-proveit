const DEFAULT_RECORD_FORM_AVAILABILITY = {
  physical: { hasOriginal: false, location: "", notes: "" },
  digital: { hasDigital: false, files: [] },
};

function getText(value) {
  return typeof value === "string" ? value : "";
}

function getAttachmentText(attachments) {
  if (!Array.isArray(attachments)) return "";
  return attachments
    .map((attachment) => `${getText(attachment?.name)} ${getText(attachment?.type)} ${getText(attachment?.mimeType)}`)
    .join(" ");
}

function getEvidenceAttachments(recordForm) {
  const attachments = [
    ...(Array.isArray(recordForm?.attachments) ? recordForm.attachments : []),
    ...(Array.isArray(recordForm?.availability?.digital?.files) ? recordForm.availability.digital.files : []),
  ];
  const seen = new Set();

  return attachments.filter((attachment) => {
    const key = attachment?.id || attachment?.name || attachment?.storage?.imageId;
    if (!key) return true;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeWords(value) {
  return getText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter((word) => word.length >= 4);
}

function findRelevantIncident(recordForm, incidents) {
  const linkedIncidentIds = Array.isArray(recordForm?.linkedIncidentIds) ? recordForm.linkedIncidentIds : [];
  const linkedIncident = incidents.find((incident) => linkedIncidentIds.includes(incident.id));
  if (linkedIncident) return linkedIncident;

  const evidenceWords = new Set(normalizeWords(`${getText(recordForm?.title)} ${getText(recordForm?.description)}`));
  if (evidenceWords.size === 0) return null;

  let bestMatch = null;
  let bestScore = 0;
  for (const incident of incidents) {
    const incidentWords = normalizeWords(`${getText(incident?.title)} ${getText(incident?.description)} ${getText(incident?.summary)}`);
    const score = incidentWords.reduce((total, word) => total + (evidenceWords.has(word) ? 1 : 0), 0);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = incident;
    }
  }

  return bestScore >= 2 ? bestMatch : null;
}

function hasAny(text, words) {
  return words.some((word) => text.includes(word));
}

function getEvidenceSuggestionKind(recordForm) {
  const attachments = getEvidenceAttachments(recordForm);
  const text = `${getText(recordForm?.title)} ${getText(recordForm?.description)} ${getAttachmentText(attachments)}`.toLowerCase();
  const hasVisualAttachment = attachments.some((attachment) => {
    const name = getText(attachment?.name).toLowerCase();
    const mimeType = getText(attachment?.mimeType || attachment?.type).toLowerCase();
    return (
      mimeType.startsWith("image/") ||
      /\.(png|jpe?g|gif|webp|heic|heif|bmp|tiff?)$/.test(name) ||
      hasAny(name, ["screenshot", "photo", "image", "picture"])
    );
  });

  if (hasAny(text, ["payment", "invoice", "transfer", "receipt", "rent", "amount", "euro", "bank", "paid", "deposit"])) {
    return "financial";
  }
  if (hasAny(text, ["email", "whatsapp", "message", "letter", "reply", "notice", "sms", "texted", "mailed"])) {
    return "communication";
  }
  if (hasVisualAttachment) return "visual";
  return "default";
}

export function suggestEvidenceMetadataForForm(recordForm, selectedCase = {}) {
  const incidents = Array.isArray(selectedCase?.incidents) ? selectedCase.incidents : [];
  const incident = findRelevantIncident(recordForm, incidents);
  const incidentTitle = incident?.title || "";
  const kind = getEvidenceSuggestionKind(recordForm);
  const sequenceGroup = incidentTitle || {
    financial: "Payment / financial record",
    communication: "Communication / notice sequence",
    visual: "Visual condition record",
    default: "Evidence review",
  }[kind];

  const baseByKind = {
    financial: {
      evidenceRole: "ANCHOR_EVIDENCE",
      relevance: "high",
      importance: "strong",
      functionSummary: "Helps establish payment, invoice, receipt, transfer, amount, rent, or bank-record details.",
    },
    communication: {
      evidenceRole: "COMMUNICATION_EVIDENCE",
      relevance: "high",
      importance: "strong",
      functionSummary: "Helps establish what was communicated, noticed, requested, replied to, or acknowledged.",
    },
    visual: {
      evidenceRole: "CORROBORATING_EVIDENCE",
      relevance: "medium",
      importance: "supporting",
      functionSummary: "Visually documents the condition, status, screenshot, or scene described by this evidence.",
    },
    default: {
      evidenceRole: "OTHER",
      relevance: "medium",
      importance: "supporting",
      functionSummary: "Provides supporting context for review alongside the linked case records.",
    },
  };

  const suggestion = {
    ...baseByKind[kind],
    sequenceGroup,
  };

  if (incidentTitle) {
    suggestion.functionSummary = `${suggestion.functionSummary} Linked to incident: ${incidentTitle}.`;
  }

  return {
    ...recordForm,
    evidenceRole: suggestion.evidenceRole,
    functionSummary: suggestion.functionSummary,
    sequenceGroup: suggestion.sequenceGroup,
    relevance: suggestion.relevance,
    importance: suggestion.importance,
  };
}

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
