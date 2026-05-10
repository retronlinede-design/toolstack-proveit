import { buildCaseLinkMapExportPayload } from "../export/linkMapExport.js";

const DIAGNOSTIC_RECORD_TYPES = ["incidents", "evidence", "documents", "ledger", "strategy"];
const SEQUENCE_RECORD_TYPES = ["incidents", "evidence", "documents", "strategy"];
const ATTACHMENT_RECORD_TYPES = ["incidents", "evidence", "documents", "ledger", "strategy", "tasks"];

function safeText(value) {
  return typeof value === "string" ? value : "";
}

function compactText(value) {
  return safeText(value).replace(/\s+/g, " ").trim();
}

function isTrackingRecordDocument(doc) {
  return typeof doc?.textContent === "string" && doc.textContent.includes("[TRACK RECORD]");
}

function getRecordType(collection) {
  if (collection === "incidents") return "incident";
  if (collection === "evidence") return "evidence";
  if (collection === "documents") return "document";
  if (collection === "ledger") return "ledger";
  if (collection === "strategy") return "strategy";
  if (collection === "tasks") return "task";
  return collection || "record";
}

function getRecordTitle(record = {}, fallbackType = "record") {
  return record.title || record.label || record.id || `Untitled ${fallbackType}`;
}

function getAttachmentName(attachment = {}) {
  return attachment.name || attachment.fileName || attachment.filename || "";
}

function getAttachmentMimeType(attachment = {}) {
  return attachment.mimeType || attachment.type || "";
}

function getImageName(image = {}) {
  return image.name || image.fileName || image.filename || "";
}

function getImageMimeType(image = {}) {
  return image.mimeType || image.type || getDataUrlMimeType(image.dataUrl || image.backupDataUrl);
}

function getDataUrlMimeType(dataUrl = "") {
  const match = typeof dataUrl === "string" ? dataUrl.match(/^data:([^;,]+)[;,]/) : null;
  return match?.[1] || "";
}

function hasImagePayload(image = {}) {
  // Existing image-store entries use dataUrl. backupDataUrl appears in full-backup payloads; binary/blob fields are tolerated for compatibility.
  return !!(
    image.dataUrl ||
    image.backupDataUrl ||
    image.blob ||
    image.binary ||
    image.payload ||
    image.arrayBuffer
  );
}

function normalizeDiagnosticCases(caseData = {}) {
  if (Array.isArray(caseData)) return caseData;
  if (Array.isArray(caseData?.cases)) return caseData.cases;
  if (caseData?.caseItem) return [caseData.caseItem];
  if (caseData?.case) return [caseData.case];
  if (caseData?.id && (caseData.incidents || caseData.evidence || caseData.documents || caseData.strategy || caseData.ledger)) {
    return [caseData];
  }
  return [];
}

function normalizeDiagnosticImages(caseData = {}) {
  if (Array.isArray(caseData?.images)) return caseData.images;
  if (Array.isArray(caseData?.imageStore)) return caseData.imageStore;
  if (caseData?.imageCache && typeof caseData.imageCache === "object") return Object.values(caseData.imageCache);
  return [];
}

function getRecordDate(record = {}) {
  return record.eventDate || record.date || record.documentDate || record.dueDate || record.paymentDate || record.period || record.createdAt || "";
}

function diagnosticRecord(record = {}, recordType = "record", extra = {}) {
  return {
    id: record.id || "",
    type: recordType,
    title: getRecordTitle(record, recordType),
    date: getRecordDate(record),
    ...extra,
  };
}

function nodeRecord(node = {}, extra = {}) {
  return {
    id: node.id || "",
    type: node.type || "record",
    title: node.title || node.id || "Untitled record",
    date: node.date || "",
    ...extra,
  };
}

function countBy(items = [], keyFn) {
  return items.reduce((counts, item) => {
    const key = keyFn(item);
    if (!key) return counts;
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});
}

function sortRecords(records = []) {
  return [...records].sort((a, b) => {
    const dateCompare = String(a.date || "").localeCompare(String(b.date || ""));
    if (dateCompare !== 0) return dateCompare;
    const typeCompare = String(a.type || "").localeCompare(String(b.type || ""));
    if (typeCompare !== 0) return typeCompare;
    return String(a.title || "").localeCompare(String(b.title || ""));
  });
}

function getCaseRecords(caseItem, collections = DIAGNOSTIC_RECORD_TYPES) {
  return collections.flatMap((collection) => {
    const records = Array.isArray(caseItem?.[collection]) ? caseItem[collection] : [];
    const recordType = getRecordType(collection);
    return records
      .filter((record) => record?.id)
      .map((record) => ({
        record,
        collection,
        recordType: collection === "documents" && isTrackingRecordDocument(record) ? "tracking_record" : recordType,
      }));
  });
}

function collectRecordAttachmentReferences(caseItem = {}) {
  const references = [];
  const seen = new Set();

  const addAttachment = ({ record, collection, recordType, attachment, location }) => {
    const imageId = attachment?.storage?.imageId;
    if (!imageId) return;

    const key = `${caseItem?.id || ""}:${collection}:${record?.id || ""}:${imageId}:${attachment?.id || ""}`;
    if (seen.has(key)) return;
    seen.add(key);

    references.push({
      caseId: caseItem?.id || "",
      caseName: caseItem?.name || "",
      recordId: record?.id || "",
      recordType,
      recordTitle: getRecordTitle(record, recordType),
      attachmentId: attachment?.id || "",
      attachmentName: getAttachmentName(attachment),
      attachmentMimeType: getAttachmentMimeType(attachment),
      attachmentSize: Number.isFinite(Number(attachment?.size)) ? Number(attachment.size) : null,
      imageId: String(imageId),
      location,
    });
  };

  ATTACHMENT_RECORD_TYPES.forEach((collection) => {
    const records = Array.isArray(caseItem?.[collection]) ? caseItem[collection] : [];
    const recordType = getRecordType(collection);

    records.forEach((record) => {
      (Array.isArray(record?.attachments) ? record.attachments : []).forEach((attachment) => {
        addAttachment({ record, collection, recordType, attachment, location: "attachments" });
      });

      if (collection === "evidence") {
        (Array.isArray(record?.availability?.digital?.files) ? record.availability.digital.files : []).forEach((attachment) => {
          addAttachment({ record, collection, recordType, attachment, location: "availability.digital.files" });
        });
      }
    });
  });

  return references;
}

export function runAttachmentIntegrityCheck(caseData = {}) {
  const cases = normalizeDiagnosticCases(caseData);
  const images = normalizeDiagnosticImages(caseData).filter((image) => image?.id);
  const imagesById = new Map(images.map((image) => [String(image.id), image]));
  const references = cases.flatMap((caseItem) => collectRecordAttachmentReferences(caseItem));
  const referencedImageIds = new Set(references.map((reference) => reference.imageId));
  const orphanedRecordReferences = [];
  const metadataMismatches = [];

  references.forEach((reference) => {
    const image = imagesById.get(reference.imageId);

    // Record reference check: a record points to an image-store id that is absent.
    if (!image) {
      orphanedRecordReferences.push({
        ...reference,
        issue: "missing_image",
        details: `Attachment references image ${reference.imageId}, but no image-store entry exists.`,
      });
      return;
    }

    // Payload check: image metadata exists, but the stored binary/data URL payload is missing.
    if (!hasImagePayload(image)) {
      orphanedRecordReferences.push({
        ...reference,
        issue: "missing_payload",
        details: `Attachment references image ${reference.imageId}, but the image-store entry has no payload.`,
      });
    }

    const mismatches = [];
    const imageName = getImageName(image);
    const imageMimeType = getImageMimeType(image);
    const imageSize = Number.isFinite(Number(image.size)) ? Number(image.size) : null;

    // Metadata fields are optional in older image-store rows, so absent image metadata is not treated as a mismatch.
    if (reference.attachmentName && imageName && reference.attachmentName !== imageName) {
      mismatches.push({ field: "filename", recordValue: reference.attachmentName, imageValue: imageName });
    }
    if (reference.attachmentMimeType && imageMimeType && reference.attachmentMimeType !== imageMimeType) {
      mismatches.push({ field: "mimeType", recordValue: reference.attachmentMimeType, imageValue: imageMimeType });
    }
    if (reference.attachmentSize != null && imageSize != null && reference.attachmentSize !== imageSize) {
      mismatches.push({ field: "size", recordValue: reference.attachmentSize, imageValue: imageSize });
    }

    if (mismatches.length > 0) {
      metadataMismatches.push({
        ...reference,
        mismatches,
        details: `Attachment metadata does not match image-store metadata for ${reference.imageId}.`,
      });
    }
  });

  // Orphan image check: image-store row exists but no canonical case record references it.
  const orphanedImages = images
    .filter((image) => !referencedImageIds.has(String(image.id)))
    .map((image) => ({
      caseId: image.caseId || "",
      imageId: String(image.id),
      details: "Image-store entry is not referenced by any case record attachment.",
      filename: getImageName(image),
      mimeType: getImageMimeType(image),
      size: Number.isFinite(Number(image.size)) ? Number(image.size) : null,
      hasPayload: hasImagePayload(image),
    }));

  return {
    orphanedRecordReferences,
    orphanedImages,
    metadataMismatches,
  };
}

function getLinkMetrics(linkMap) {
  const validEdges = (linkMap.edges || []).filter((edge) => edge.status === "resolved");
  const linkCounts = new Map((linkMap.nodes || []).map((node) => [node.id, 0]));

  validEdges.forEach((edge) => {
    linkCounts.set(edge.sourceId, (linkCounts.get(edge.sourceId) || 0) + 1);
    linkCounts.set(edge.targetId, (linkCounts.get(edge.targetId) || 0) + 1);
  });

  const nodesByLinkCount = (linkMap.nodes || []).map((node) => ({
    ...node,
    linkCount: linkCounts.get(node.id) || 0,
  }));
  const totalRecords = (linkMap.nodes || []).length;
  const totalResolvedLinks = validEdges.length;

  return {
    totalRecords,
    totalLinks: totalResolvedLinks,
    averageLinksPerRecord: totalRecords > 0 ? Number((totalResolvedLinks / totalRecords).toFixed(2)) : 0,
    nodesByLinkCount,
    orphanRecords: nodesByLinkCount.filter((node) => node.linkCount === 0).map((node) => nodeRecord(node, { linkCount: 0 })),
    weaklyLinkedRecords: nodesByLinkCount.filter((node) => node.linkCount === 1).map((node) => nodeRecord(node, { linkCount: 1 })),
    highlyConnectedRecords: nodesByLinkCount.filter((node) => node.linkCount >= 5).map((node) => nodeRecord(node, { linkCount: node.linkCount })),
  };
}

export function analyzeEvidenceCoverage(caseItem) {
  const linkMap = buildCaseLinkMapExportPayload(caseItem || {});
  const validEdges = (linkMap.edges || []).filter((edge) => edge.status === "resolved");
  const incidentNodes = (linkMap.nodes || []).filter((node) => node.type === "incident");
  const evidenceNodes = (linkMap.nodes || []).filter((node) => node.type === "evidence");
  const incidentEvidenceCounts = new Map(incidentNodes.map((node) => [node.id, 0]));
  const evidenceLinkedToIncidentIds = new Set();

  validEdges.forEach((edge) => {
    const incidentToEvidence = edge.sourceType === "incident" && edge.targetType === "evidence";
    const evidenceToIncident = edge.sourceType === "evidence" && edge.targetType === "incident";

    if (incidentToEvidence && incidentEvidenceCounts.has(edge.sourceId)) {
      incidentEvidenceCounts.set(edge.sourceId, incidentEvidenceCounts.get(edge.sourceId) + 1);
      evidenceLinkedToIncidentIds.add(edge.targetId);
    }
    if (evidenceToIncident && incidentEvidenceCounts.has(edge.targetId)) {
      incidentEvidenceCounts.set(edge.targetId, incidentEvidenceCounts.get(edge.targetId) + 1);
      evidenceLinkedToIncidentIds.add(edge.sourceId);
    }
  });

  const incidentsById = new Map((caseItem?.incidents || []).map((incident) => [incident.id, incident]));
  const getIncidentEvidenceStatus = (node) => incidentsById.get(node.id)?.evidenceStatus || "needs_evidence";
  const incidentsWithoutEvidence = incidentNodes.filter((node) => incidentEvidenceCounts.get(node.id) === 0);
  const incidentsWithEvidence = incidentNodes.filter((node) => incidentEvidenceCounts.get(node.id) > 0);
  const unusedEvidence = evidenceNodes.filter((node) => !evidenceLinkedToIncidentIds.has(node.id));

  const evidenceById = new Map((caseItem?.evidence || []).map((evidence) => [evidence.id, evidence]));
  const trackingRecordProvenance = (caseItem?.documents || [])
    .filter((doc) => isTrackingRecordDocument(doc) && Array.isArray(doc.basedOnEvidenceIds) && doc.basedOnEvidenceIds.length > 0)
    .map((doc) => ({
      document: diagnosticRecord(doc, "tracking_record"),
      evidence: doc.basedOnEvidenceIds
        .map((evidenceId) => evidenceById.get(evidenceId))
        .filter(Boolean)
        .map((evidence) => diagnosticRecord(evidence, "evidence")),
    }))
    .filter((entry) => entry.evidence.length > 0);

  const trackingRecordsByEvidence = new Map();
  trackingRecordProvenance.forEach(({ document, evidence }) => {
    evidence.forEach((item) => {
      if (!trackingRecordsByEvidence.has(item.id)) {
        trackingRecordsByEvidence.set(item.id, { evidence: item, records: [] });
      }
      trackingRecordsByEvidence.get(item.id).records.push(document);
    });
  });

  return {
    incidentEvidenceCounts: Object.fromEntries(incidentEvidenceCounts.entries()),
    incidentsWithoutEvidence: incidentsWithoutEvidence.map((node) => nodeRecord(node, { evidenceStatus: getIncidentEvidenceStatus(node) })),
    incidentsNeedingEvidence: incidentsWithoutEvidence
      .filter((node) => ["needs_evidence", "documented"].includes(getIncidentEvidenceStatus(node)))
      .map((node) => nodeRecord(node, { evidenceStatus: getIncidentEvidenceStatus(node) })),
    witnessedContextualIncidents: incidentsWithoutEvidence
      .filter((node) => ["witnessed", "contextual"].includes(getIncidentEvidenceStatus(node)))
      .map((node) => nodeRecord(node, { evidenceStatus: getIncidentEvidenceStatus(node) })),
    unverifiedIncidents: incidentsWithoutEvidence
      .filter((node) => getIncidentEvidenceStatus(node) === "unverified")
      .map((node) => nodeRecord(node, { evidenceStatus: getIncidentEvidenceStatus(node) })),
    incidentsWithEvidence: incidentsWithEvidence.map((node) => nodeRecord(node, { evidenceCount: incidentEvidenceCounts.get(node.id) || 0 })),
    unusedEvidence: unusedEvidence.map((node) => nodeRecord(node)),
    trackingRecordProvenance,
    evidenceUsedByTrackingRecords: [...trackingRecordsByEvidence.values()],
  };
}

export function analyzeSequenceGroup(caseItem, sequenceGroup = "") {
  const targetGroup = compactText(sequenceGroup);
  const groups = new Map();
  const ungroupedRecords = [];

  getCaseRecords(caseItem, SEQUENCE_RECORD_TYPES).forEach(({ record, recordType }) => {
    const groupName = compactText(record.sequenceGroup);
    const item = diagnosticRecord(record, recordType);

    if (!groupName) {
      ungroupedRecords.push(item);
      return;
    }

    if (!groups.has(groupName)) {
      groups.set(groupName, {
        name: groupName,
        totalCount: 0,
        counts: { incident: 0, evidence: 0, document: 0, tracking_record: 0, strategy: 0 },
        records: [],
      });
    }

    const group = groups.get(groupName);
    group.totalCount += 1;
    group.counts[recordType] = (group.counts[recordType] || 0) + 1;
    group.records.push(item);
  });

  const sortedGroups = [...groups.values()]
    .map((group) => ({ ...group, records: sortRecords(group.records) }))
    .sort((a, b) => a.name.localeCompare(b.name));

  if (targetGroup) {
    return sortedGroups.find((group) => group.name === targetGroup) || {
      name: targetGroup,
      totalCount: 0,
      counts: { incident: 0, evidence: 0, document: 0, tracking_record: 0, strategy: 0 },
      records: [],
    };
  }

  return {
    groups: sortedGroups,
    ungroupedRecords: sortRecords(ungroupedRecords),
  };
}

export function analyzeChronology(caseItem) {
  const items = getCaseRecords(caseItem)
    .map(({ record, recordType }) => diagnosticRecord(record, recordType))
    .sort((a, b) => {
      if (a.date && b.date && a.date !== b.date) return a.date.localeCompare(b.date);
      if (a.date && !b.date) return -1;
      if (!a.date && b.date) return 1;
      return String(a.title || "").localeCompare(String(b.title || ""));
    });
  const missingDateRecords = items.filter((item) => !item.date);
  const datedItems = items.filter((item) => item.date);
  const duplicateDateGroups = Object.entries(countBy(datedItems, (item) => item.date))
    .filter(([, count]) => count > 1)
    .map(([date, count]) => ({ date, count }));

  return {
    totalItems: items.length,
    datedItemCount: datedItems.length,
    missingDateRecords,
    duplicateDateGroups,
    firstDate: datedItems[0]?.date || "",
    lastDate: datedItems[datedItems.length - 1]?.date || "",
    items,
  };
}

function analyzeDuplicateTitles(caseItem) {
  const titleGroups = new Map();

  getCaseRecords(caseItem).forEach(({ record, recordType }) => {
    const title = compactText(getRecordTitle(record, recordType));
    const key = title.toLowerCase();
    if (!key || key.startsWith("untitled ")) return;
    if (!titleGroups.has(key)) titleGroups.set(key, []);
    titleGroups.get(key).push(diagnosticRecord(record, recordType));
  });

  return [...titleGroups.entries()]
    .filter(([, records]) => records.length > 1)
    .map(([normalizedTitle, records]) => ({
      normalizedTitle,
      records: sortRecords(records),
    }))
    .sort((a, b) => a.normalizedTitle.localeCompare(b.normalizedTitle));
}

function analyzeMilestoneCoverage(caseItem) {
  const milestoneRecords = [
    ...(caseItem?.incidents || []).filter((item) => !!item?.isMilestone).map((item) => diagnosticRecord(item, "incident")),
    ...(caseItem?.evidence || []).filter((item) => !!item?.isMilestone).map((item) => diagnosticRecord(item, "evidence")),
  ];

  return {
    totalMilestones: milestoneRecords.length,
    byType: countBy(milestoneRecords, (item) => item.type),
    milestonesWithoutDate: milestoneRecords.filter((item) => !item.date),
    records: sortRecords(milestoneRecords),
  };
}

function analyzeOpenIssues(caseItem, evidenceCoverage) {
  const openTasks = (caseItem?.tasks || []).filter((task) => !["done", "closed", "archived"].includes(task?.status));
  const openStrategy = (caseItem?.strategy || []).filter((item) => !["done", "closed", "archived"].includes(item?.status));

  return {
    openTaskCount: openTasks.length,
    openStrategyCount: openStrategy.length,
    unsupportedIncidentCount: evidenceCoverage.incidentsNeedingEvidence.length,
    unusedEvidenceCount: evidenceCoverage.unusedEvidence.length,
  };
}

export function analyzeCaseDiagnostics(caseItem) {
  const linkMap = buildCaseLinkMapExportPayload(caseItem || {});
  const linkMetrics = getLinkMetrics(linkMap);
  const evidenceCoverage = analyzeEvidenceCoverage(caseItem || {});
  const sequenceGroups = analyzeSequenceGroup(caseItem || {});
  const chronology = analyzeChronology(caseItem || {});
  const duplicateTitleSuspicions = analyzeDuplicateTitles(caseItem || {});
  const milestoneCoverage = analyzeMilestoneCoverage(caseItem || {});
  const openIssues = analyzeOpenIssues(caseItem || {}, evidenceCoverage);
  const nodeCounts = linkMap.summary.nodeCountsByType || {};
  const brokenLinks = linkMap.missingLinks || [];
  const risks = [];
  const warnings = [];
  const suggestions = [];

  if (brokenLinks.length > 0) risks.push({ id: "broken-links", message: `${brokenLinks.length} broken link(s) detected.` });
  if (evidenceCoverage.incidentsNeedingEvidence.length > 0) risks.push({ id: "unsupported-incidents", message: `${evidenceCoverage.incidentsNeedingEvidence.length} incident(s) still need evidence.` });
  if (chronology.missingDateRecords.length > 0) warnings.push({ id: "chronology-missing-dates", message: `${chronology.missingDateRecords.length} record(s) have no chronology date.` });
  if (duplicateTitleSuspicions.length > 0) warnings.push({ id: "duplicate-title-suspicion", message: `${duplicateTitleSuspicions.length} duplicate title group(s) detected.` });
  if (sequenceGroups.ungroupedRecords.length > 0) suggestions.push({ id: "sequence-groups", message: "Assign sequenceGroup values to records that belong to the same issue or thread." });
  if (linkMetrics.weaklyLinkedRecords.length > 0) suggestions.push({ id: "weak-links", message: "Strengthen weak records by linking them to relevant incidents, evidence, documents, or ledger entries." });

  // TODO: attach escalation readiness signals here.
  // TODO: attach report scoring here.
  // TODO: attach contradiction analysis here.
  // TODO: attach AI-assisted diagnostics here.
  return {
    overview: {
      caseId: caseItem?.id || "",
      caseName: caseItem?.name || "",
      totalRecords: linkMetrics.totalRecords,
      totalLinks: linkMetrics.totalLinks,
      brokenLinkCount: brokenLinks.length,
      nodeCountsByType: nodeCounts,
      documentCount: (nodeCounts.document || 0) + (nodeCounts.tracking_record || 0),
    },
    integrity: {
      brokenLinks,
      orphanRecords: linkMetrics.orphanRecords,
      weaklyLinkedRecords: linkMetrics.weaklyLinkedRecords,
      highlyConnectedRecords: linkMetrics.highlyConnectedRecords,
      linkDensity: {
        totalRecords: linkMetrics.totalRecords,
        totalLinks: linkMetrics.totalLinks,
        averageLinksPerRecord: linkMetrics.averageLinksPerRecord,
      },
      integrityFlags: linkMap.analysis?.integrityFlags || {},
    },
    evidenceCoverage,
    chronology,
    sequenceGroups,
    duplicates: {
      titleSuspicions: duplicateTitleSuspicions,
    },
    openIssues,
    milestoneCoverage,
    risks,
    warnings,
    suggestions,
  };
}
