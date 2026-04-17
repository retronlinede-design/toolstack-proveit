import { normalizeQuickCaptureStatus } from "./caseDomain.js";

export function normalizeQuickCapture(item, { normalizeAttachments = false } = {}) {
  return {
    ...item,
    source: item.source || "manual",
    updatedAt: item.updatedAt || item.createdAt || new Date().toISOString(),
    status: normalizeQuickCaptureStatus(item.status),
    convertedTo: item.convertedTo || null,
    ...(normalizeAttachments
      ? { attachments: Array.isArray(item.attachments) ? item.attachments : [] }
      : {}),
  };
}

export function createQuickCaptureFromForm(captureForm, selectedCaptureCase) {
  const newCaptureId = crypto.randomUUID();
  const newCapture = {
    id: newCaptureId,
    caseId: selectedCaptureCase.id,
    caseName: selectedCaptureCase.name,
    title: captureForm.title.trim(),
    date: captureForm.date || new Date().toISOString().slice(0, 10),
    note: captureForm.note.trim(),
    attachments: captureForm.attachments,
    status: "unreviewed",
    convertedTo: null,
    source: "manual",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  return newCapture;
}

export function archiveQuickCapture(capture) {
  return { ...capture, status: "archived", updatedAt: new Date().toISOString() };
}

export function markQuickCaptureConverted(capture, targetType) {
  return { ...capture, status: "converted", convertedTo: targetType, updatedAt: new Date().toISOString() };
}
