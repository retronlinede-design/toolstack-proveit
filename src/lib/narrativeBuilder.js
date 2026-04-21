import { normalizeCase, sortTimelineItems } from "../domain/caseDomain.js";
import { resolveRecordById } from "../domain/linkingResolvers.js";

function safeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function isTrackingRecordDocument(record) {
  return typeof record?.textContent === "string" && record.textContent.includes("[TRACK RECORD]");
}

function mapSupportingEvidence(record) {
  return {
    id: record.id,
    title: record.title || "",
    functionSummary: safeText(record.functionSummary) || safeText(record.description) || safeText(record.notes),
    sequenceGroup: safeText(record.sequenceGroup),
    evidenceRole: record.evidenceRole || "OTHER",
  };
}

function mapSupportingRecord(displayMeta) {
  const record = displayMeta?.record || {};
  const derivedRecordType = displayMeta?.recordType === "document" && isTrackingRecordDocument(record)
    ? "record"
    : displayMeta?.recordType === "document"
      ? "document"
      : displayMeta?.recordType || "record";

  return {
    id: displayMeta.id,
    title: displayMeta.title || "",
    summary: safeText(displayMeta.summary),
    recordType: derivedRecordType,
  };
}

function getLinkedEvidenceForIncident(caseData, incident) {
  const explicitIds = Array.isArray(incident?.linkedEvidenceIds) ? incident.linkedEvidenceIds : [];
  const explicitIdSet = new Set(explicitIds);
  const inferredLinked = (caseData.evidence || []).filter((item) =>
    Array.isArray(item.linkedIncidentIds) && item.linkedIncidentIds.includes(incident.id)
  );

  const orderedEvidence = [
    ...(caseData.evidence || []).filter((item) => explicitIdSet.has(item.id)),
    ...inferredLinked.filter((item) => !explicitIdSet.has(item.id)),
  ];

  const seen = new Set();
  return orderedEvidence.filter((item) => {
    if (!item?.id || seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function getSupportingRecordsForIncident(caseData, incident, supportingEvidenceIds) {
  const linkedRecordIds = Array.isArray(incident?.linkedRecordIds) ? incident.linkedRecordIds : [];
  const seen = new Set();

  return linkedRecordIds
    .map((recordId) => resolveRecordById(caseData, recordId))
    .filter(Boolean)
    .filter((item) => {
      if (supportingEvidenceIds.has(item.id)) return false;
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    })
    .map(mapSupportingRecord);
}

function getEstablishesStatements(supportingEvidence) {
  const seen = new Set();

  return supportingEvidence
    .map((item) => safeText(item.functionSummary))
    .filter(Boolean)
    .filter((statement) => {
      const key = statement.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export function buildNarrativeSections(caseItem) {
  const caseData = normalizeCase(caseItem || {});
  const incidents = sortTimelineItems(caseData.incidents || []);

  return incidents.map((incident) => {
    const linkedEvidence = getLinkedEvidenceForIncident(caseData, incident);
    const supportingEvidence = linkedEvidence.map(mapSupportingEvidence);
    const supportingEvidenceIds = new Set(supportingEvidence.map((item) => item.id));
    const supportingRecords = getSupportingRecordsForIncident(caseData, incident, supportingEvidenceIds);

    return {
      date: incident.eventDate || incident.date || "",
      incident: {
        id: incident.id,
        title: incident.title || "",
        description: incident.description || "",
        notes: incident.notes || "",
      },
      supportingEvidence,
      supportingRecords,
      establishes: getEstablishesStatements(supportingEvidence),
    };
  });
}
