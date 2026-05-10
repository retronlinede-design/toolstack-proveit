import { analyzeCaseDiagnostics, analyzeSequenceGroup } from "../diagnostics/caseDiagnostics.js";
import { resolveRecordById } from "../domain/linkingResolvers.js";

export const THREAD_ISSUE_REPORT = "THREAD_ISSUE_REPORT";
export const EVIDENCE_PACK_REPORT = "EVIDENCE_PACK_REPORT";
export const DOCUMENT_PACK_REPORT = "DOCUMENT_PACK_REPORT";
export const LEDGER_PACK_REPORT = "LEDGER_PACK_REPORT";
export const CASE_BUNDLE_REPORT = "CASE_BUNDLE_REPORT";
export const EXECUTIVE_SUMMARY_REPORT = "EXECUTIVE_SUMMARY_REPORT";

function safeText(value) {
  return typeof value === "string" ? value : "";
}

function compactText(value) {
  return safeText(value).replace(/\s+/g, " ").trim();
}

function shortText(value, limit = 220) {
  const text = compactText(value);
  if (text.length <= limit) return text;
  return `${text.slice(0, limit - 3).trim()}...`;
}

function uniqueValues(values = []) {
  return [...new Set(values.filter(Boolean))];
}

function getRecordTitle(record = {}, recordType = "record") {
  if (recordType === "ledger") return record.label || record.title || record.id || "Untitled ledger entry";
  return record.title || record.label || record.id || `Untitled ${recordType}`;
}

function getRecordDate(record = {}) {
  return record.eventDate || record.date || record.capturedAt || record.documentDate || record.dueDate || record.paymentDate || record.period || record.createdAt || "";
}

function getSummary(record = {}, recordType = "record") {
  if (recordType === "evidence") return shortText(record.functionSummary || record.description || record.notes || record.reviewNotes);
  if (recordType === "document") return shortText(record.summary || record.textContent || record.source || record.notes);
  if (recordType === "ledger") return shortText(record.notes || record.counterparty || record.category || record.period);
  if (recordType === "strategy") return shortText(record.description || record.notes || record.source);
  return shortText(record.description || record.summary || record.notes);
}

function isSameSequenceGroup(record = {}, sequenceGroup = "") {
  return compactText(record.sequenceGroup) === sequenceGroup;
}

function getRecordLinkIds(record = {}) {
  const ids = [
    ...(Array.isArray(record.linkedRecordIds) ? record.linkedRecordIds : []),
    ...(Array.isArray(record.linkedEvidenceIds) ? record.linkedEvidenceIds : []),
    ...(Array.isArray(record.linkedIncidentIds) ? record.linkedIncidentIds : []),
    ...(Array.isArray(record.basedOnEvidenceIds) ? record.basedOnEvidenceIds : []),
    ...(Array.isArray(record.linkedIncidentRefs) ? record.linkedIncidentRefs.map((ref) => ref?.incidentId) : []),
  ];
  return uniqueValues(ids);
}

function collectTypedRecords(caseItem = {}) {
  return [
    ...(caseItem.incidents || []).filter((record) => record?.id).map((record) => ({ record, recordType: "incident" })),
    ...(caseItem.evidence || []).filter((record) => record?.id).map((record) => ({ record, recordType: "evidence" })),
    ...(caseItem.documents || []).filter((record) => record?.id).map((record) => ({ record, recordType: "document" })),
    ...(caseItem.strategy || []).filter((record) => record?.id).map((record) => ({ record, recordType: "strategy" })),
    ...(caseItem.ledger || []).filter((record) => record?.id).map((record) => ({ record, recordType: "ledger" })),
  ];
}

function resolveTitle(caseItem, id) {
  const resolved = resolveRecordById(caseItem, id);
  return resolved?.title || id;
}

function resolveLinkedRecords(caseItem, ids = []) {
  return uniqueValues(ids).map((id) => {
    const resolved = resolveRecordById(caseItem, id);
    return {
      id,
      recordType: resolved?.recordType || "unknown",
      title: resolved?.title || id,
      status: resolved ? "resolved" : "missing",
    };
  });
}

function sortChronologyItems(items = []) {
  return [...items].sort((a, b) => {
    if (a.date && b.date && a.date !== b.date) return a.date.localeCompare(b.date);
    if (a.date && !b.date) return -1;
    if (!a.date && b.date) return 1;
    const typeCompare = a.recordType.localeCompare(b.recordType);
    if (typeCompare !== 0) return typeCompare;
    return a.title.localeCompare(b.title);
  });
}

function groupChronologyItems(items = []) {
  const sorted = sortChronologyItems(items);
  const groups = [];
  const undated = [];

  sorted.forEach((item) => {
    if (!item.date) {
      undated.push(item);
      return;
    }

    const current = groups[groups.length - 1];
    if (!current || current.date !== item.date) {
      groups.push({ date: item.date, items: [item] });
      return;
    }
    current.items.push(item);
  });

  return { groups, undated };
}

function getIncludedRecordIds(caseItem = {}, sequenceGroup = "") {
  if (!sequenceGroup) return [];

  const allRecords = collectTypedRecords(caseItem);
  const primaryRecords = allRecords.filter(({ record, recordType }) => (
    recordType !== "ledger" && isSameSequenceGroup(record, sequenceGroup)
  ));
  const primaryIds = new Set(primaryRecords.map(({ record }) => record.id));
  const includedIds = new Set(primaryIds);

  primaryRecords.forEach(({ record }) => {
    getRecordLinkIds(record).forEach((id) => includedIds.add(id));
  });

  allRecords.forEach(({ record }) => {
    const linkedIds = getRecordLinkIds(record);
    if (linkedIds.some((id) => primaryIds.has(id))) {
      includedIds.add(record.id);
    }
  });

  let changed = true;
  while (changed) {
    changed = false;
    allRecords
      .filter(({ recordType }) => recordType === "ledger")
      .forEach(({ record }) => {
        if (!includedIds.has(record.id) && getRecordLinkIds(record).some((id) => includedIds.has(id))) {
          includedIds.add(record.id);
          changed = true;
        }
      });
  }

  return [...includedIds].filter((id) => resolveRecordById(caseItem, id));
}

function buildChronologyItem(record, recordType) {
  return {
    id: record.id,
    recordType,
    date: getRecordDate(record),
    title: getRecordTitle(record, recordType),
    summary: getSummary(record, recordType),
  };
}

function buildIncident(caseItem, incident = {}) {
  const linkedEvidenceIds = uniqueValues([
    ...(Array.isArray(incident.linkedEvidenceIds) ? incident.linkedEvidenceIds : []),
    ...(Array.isArray(incident.linkedRecordIds) ? incident.linkedRecordIds.filter((id) => resolveRecordById(caseItem, id)?.recordType === "evidence") : []),
  ]);
  return {
    id: incident.id,
    title: getRecordTitle(incident, "incident"),
    date: incident.date || "",
    eventDate: incident.eventDate || "",
    status: incident.status || "",
    evidenceStatus: incident.evidenceStatus || "",
    isMilestone: !!incident.isMilestone,
    sequenceGroup: incident.sequenceGroup || "",
    summary: getSummary(incident, "incident"),
    linkedEvidenceTitles: linkedEvidenceIds.map((id) => resolveTitle(caseItem, id)),
  };
}

function buildEvidence(caseItem, evidence = {}) {
  const linkedIncidentIds = uniqueValues([
    ...(Array.isArray(evidence.linkedIncidentIds) ? evidence.linkedIncidentIds : []),
    ...(Array.isArray(evidence.linkedRecordIds) ? evidence.linkedRecordIds.filter((id) => resolveRecordById(caseItem, id)?.recordType === "incident") : []),
  ]);
  const attachmentNames = Array.isArray(evidence.attachments)
    ? evidence.attachments.map((attachment) => safeText(attachment?.name).trim()).filter(Boolean)
    : [];

  return {
    id: evidence.id,
    title: getRecordTitle(evidence, "evidence"),
    date: evidence.date || "",
    capturedAt: evidence.capturedAt || "",
    status: evidence.status || "",
    evidenceRole: evidence.evidenceRole || "",
    functionSummary: safeText(evidence.functionSummary),
    linkedIncidentTitles: linkedIncidentIds.map((id) => resolveTitle(caseItem, id)),
    attachmentNames,
    attachmentCount: attachmentNames.length,
  };
}

function getEvidenceIncidentIds(caseItem, evidence = {}) {
  const explicitIds = [
    ...(Array.isArray(evidence.linkedIncidentIds) ? evidence.linkedIncidentIds : []),
    ...(Array.isArray(evidence.linkedRecordIds) ? evidence.linkedRecordIds.filter((id) => resolveRecordById(caseItem, id)?.recordType === "incident") : []),
  ];
  const reverseIds = (caseItem?.incidents || [])
    .filter((incident) => Array.isArray(incident.linkedEvidenceIds) && incident.linkedEvidenceIds.includes(evidence.id))
    .map((incident) => incident.id);
  return uniqueValues([...explicitIds, ...reverseIds]);
}

function buildEvidencePackEvidence(caseItem, evidence = {}) {
  const linkedIncidentIds = getEvidenceIncidentIds(caseItem, evidence);
  const linkedRecordIds = uniqueValues([
    ...(Array.isArray(evidence.linkedRecordIds) ? evidence.linkedRecordIds : []),
    ...(Array.isArray(evidence.linkedEvidenceIds) ? evidence.linkedEvidenceIds : []),
  ]);
  const attachmentNames = Array.isArray(evidence.attachments)
    ? evidence.attachments.map((attachment) => safeText(attachment?.name).trim()).filter(Boolean)
    : [];

  return {
    id: evidence.id,
    title: getRecordTitle(evidence, "evidence"),
    date: evidence.date || "",
    capturedAt: evidence.capturedAt || "",
    status: evidence.status || "",
    evidenceRole: evidence.evidenceRole || "",
    functionSummary: safeText(evidence.functionSummary),
    linkedIncidents: resolveLinkedRecords(caseItem, linkedIncidentIds),
    linkedRecords: resolveLinkedRecords(caseItem, linkedRecordIds),
    attachmentNames,
    attachmentCount: attachmentNames.length,
    reviewNotes: safeText(evidence.reviewNotes),
  };
}

function buildDocument(caseItem, document = {}) {
  const linkedIds = uniqueValues([
    ...(Array.isArray(document.linkedRecordIds) ? document.linkedRecordIds : []),
    ...(Array.isArray(document.basedOnEvidenceIds) ? document.basedOnEvidenceIds : []),
  ]);
  return {
    id: document.id,
    title: getRecordTitle(document, "document"),
    documentDate: document.documentDate || "",
    category: document.category || "",
    summary: getSummary(document, "document"),
    linkedRecords: resolveLinkedRecords(caseItem, linkedIds),
  };
}

function sanitizeAttachmentMetadata(attachments = []) {
  if (!Array.isArray(attachments)) return [];
  return attachments.map((attachment) => ({
    id: attachment?.id || "",
    name: safeText(attachment?.name).trim(),
    type: safeText(attachment?.type).trim(),
    size: typeof attachment?.size === "number" ? attachment.size : null,
  })).filter((attachment) => attachment.id || attachment.name || attachment.type || attachment.size !== null);
}

function buildDocumentPackDocument(caseItem, document = {}) {
  const linkedIds = uniqueValues([
    ...(Array.isArray(document.linkedRecordIds) ? document.linkedRecordIds : []),
    ...(Array.isArray(document.basedOnEvidenceIds) ? document.basedOnEvidenceIds : []),
  ]);
  const linkedRecords = resolveLinkedRecords(caseItem, linkedIds);
  const attachmentMetadata = sanitizeAttachmentMetadata(document.attachments);
  const textExcerpt = shortText(document.textContent, 600);

  return {
    id: document.id,
    title: getRecordTitle(document, "document"),
    documentDate: document.documentDate || "",
    date: document.date || "",
    createdAt: document.createdAt || "",
    updatedAt: document.updatedAt || "",
    category: document.category || "",
    sequenceGroup: document.sequenceGroup || "",
    summary: safeText(document.summary),
    notes: safeText(document.notes),
    functionSummary: safeText(document.functionSummary),
    textExcerpt,
    linkedRecords,
    linkedIncidents: linkedRecords.filter((item) => item.recordType === "incident"),
    linkedEvidence: linkedRecords.filter((item) => item.recordType === "evidence"),
    linkedStrategy: linkedRecords.filter((item) => item.recordType === "strategy"),
    attachmentMetadata,
    attachmentNames: attachmentMetadata.map((attachment) => attachment.name).filter(Boolean),
    attachmentCount: attachmentMetadata.length,
  };
}

function numberOrNull(value) {
  if (value === "" || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function buildLedger(caseItem, ledger = {}) {
  const expectedAmount = numberOrNull(ledger.expectedAmount);
  const paidAmount = numberOrNull(ledger.paidAmount);
  const differenceAmount = expectedAmount === null || paidAmount === null ? null : expectedAmount - paidAmount;
  return {
    id: ledger.id,
    label: getRecordTitle(ledger, "ledger"),
    period: ledger.period || "",
    expectedAmount,
    paidAmount,
    differenceAmount,
    status: ledger.status || ledger.proofStatus || "",
    linkedRecords: resolveLinkedRecords(caseItem, ledger.linkedRecordIds || []),
  };
}

function getLedgerAmount(ledger = {}) {
  const expectedAmount = numberOrNull(ledger.expectedAmount);
  if (expectedAmount !== null) return expectedAmount;
  const paidAmount = numberOrNull(ledger.paidAmount);
  if (paidAmount !== null) return paidAmount;
  const amount = numberOrNull(ledger.amount);
  return amount;
}

function getLedgerDirection(ledger = {}) {
  const text = [
    ledger.type,
    ledger.category,
    ledger.subType,
    ledger.label,
  ].map((item) => safeText(item).toLowerCase()).join(" ");

  if (["income", "credit", "received", "refund", "reimbursement"].some((token) => text.includes(token))) {
    return "credit";
  }
  if (["expense", "debit", "paid", "rent", "utility", "repair", "legal", "cost", "fee", "bill"].some((token) => text.includes(token))) {
    return "debit";
  }
  return "neutral";
}

function hasLedgerProof(ledger = {}, linkedRecords = []) {
  const proofType = compactText(ledger.proofType);
  const proofStatus = compactText(ledger.proofStatus).toLowerCase();
  if (proofType) return true;
  if (proofStatus && !["missing", "none", "no_proof", "unverified"].includes(proofStatus)) return true;
  return linkedRecords.some((item) => ["evidence", "document"].includes(item.recordType));
}

function buildLedgerPackEntry(caseItem, ledger = {}) {
  const amount = getLedgerAmount(ledger);
  const linkedRecords = resolveLinkedRecords(caseItem, ledger.linkedRecordIds || []);
  return {
    id: ledger.id,
    title: getRecordTitle(ledger, "ledger"),
    description: getSummary(ledger, "ledger"),
    date: ledger.paymentDate || ledger.dueDate || ledger.period || ledger.createdAt || "",
    amount,
    expectedAmount: numberOrNull(ledger.expectedAmount),
    paidAmount: numberOrNull(ledger.paidAmount),
    currency: ledger.currency || "",
    type: ledger.type || ledger.category || "",
    subType: ledger.subType || "",
    method: ledger.method || "",
    reference: ledger.reference || "",
    proofType: ledger.proofType || "",
    proofStatus: ledger.proofStatus || "",
    batchLabel: ledger.batchLabel || "",
    sequenceGroup: ledger.sequenceGroup || "",
    direction: getLedgerDirection(ledger),
    hasProof: hasLedgerProof(ledger, linkedRecords),
    linkedRecords,
    linkedIncidents: linkedRecords.filter((item) => item.recordType === "incident"),
    linkedEvidence: linkedRecords.filter((item) => item.recordType === "evidence"),
    linkedDocuments: linkedRecords.filter((item) => item.recordType === "document"),
    linkedStrategy: linkedRecords.filter((item) => item.recordType === "strategy"),
  };
}

function buildThreadDiagnostics(caseItem, sequenceGroup, includedIds) {
  const diagnostics = analyzeCaseDiagnostics(caseItem || {});
  const group = analyzeSequenceGroup(caseItem || {}, sequenceGroup);
  const includeRecord = (record) => includedIds.has(record?.id);
  const brokenLinks = (diagnostics.integrity?.brokenLinks || []).filter((link) => (
    includedIds.has(link.sourceId) || includedIds.has(link.targetId)
  ));
  const warnings = [...(diagnostics.warnings || [])];
  const suggestions = [...(diagnostics.suggestions || [])];

  if (!sequenceGroup) {
    warnings.push({ id: "missing-sequence-group", message: "Select a sequenceGroup before building a thread report." });
  } else if (group.totalCount === 0) {
    warnings.push({ id: "empty-sequence-group", message: `No records use sequenceGroup "${sequenceGroup}".` });
  }

  return {
    sequenceGroup: group,
    unsupportedIncidents: (diagnostics.evidenceCoverage?.incidentsNeedingEvidence || []).filter(includeRecord),
    unusedEvidence: (diagnostics.evidenceCoverage?.unusedEvidence || []).filter(includeRecord),
    brokenLinks,
    weaklyLinkedRecords: (diagnostics.integrity?.weaklyLinkedRecords || []).filter(includeRecord),
    warnings,
    suggestions,
  };
}

function buildDiagnosticsSummary(diagnostics) {
  const warningCount = (diagnostics.warnings || []).length + (diagnostics.brokenLinks || []).length;
  const suggestionCount = (diagnostics.suggestions || []).length;
  return {
    unsupportedIncidentCount: (diagnostics.unsupportedIncidents || []).length,
    unusedEvidenceCount: (diagnostics.unusedEvidence || []).length,
    weakLinkCount: (diagnostics.weaklyLinkedRecords || []).length,
    brokenLinkCount: (diagnostics.brokenLinks || []).length,
    warningCount,
    suggestionCount,
  };
}

function itemMentionsSequenceGroup(item, sequenceGroup) {
  if (!sequenceGroup) return false;
  return safeText(item).toLowerCase().includes(sequenceGroup.toLowerCase());
}

function buildOpenQuestionsAndNextActions(caseItem, strategyRecords, sequenceGroup) {
  const openStrategy = strategyRecords.filter((item) => !["done", "closed", "archived"].includes(item.status));
  const openQuestions = openStrategy
    .filter((item) => [item.title, item.description, item.notes].some((value) => safeText(value).includes("?")) || item.status === "question")
    .map((item) => ({
      id: item.id,
      title: getRecordTitle(item, "strategy"),
      status: item.status || "",
      note: getSummary(item, "strategy"),
    }));
  const strategyActions = openStrategy.map((item) => ({
    source: "strategy",
    id: item.id,
    text: getRecordTitle(item, "strategy"),
    note: getSummary(item, "strategy"),
  }));
  const actionSummary = caseItem?.actionSummary || {};
  const summaryActions = [
    ...(Array.isArray(actionSummary.nextActions) ? actionSummary.nextActions : []),
    ...(Array.isArray(actionSummary.criticalDeadlines) ? actionSummary.criticalDeadlines : []),
  ]
    .filter((item) => itemMentionsSequenceGroup(item, sequenceGroup))
    .map((item) => ({ source: "actionSummary", text: item, note: "" }));

  return {
    openQuestions,
    nextActions: [...strategyActions, ...summaryActions],
  };
}

export function buildThreadIssueReport(caseItem = {}, sequenceGroupValue = "", options = {}) {
  const sequenceGroup = compactText(sequenceGroupValue);
  const generatedAt = options.generatedAt || new Date().toISOString();
  const includedRecordIds = getIncludedRecordIds(caseItem, sequenceGroup);
  const includedIdSet = new Set(includedRecordIds);
  const allRecords = collectTypedRecords(caseItem).filter(({ record }) => includedIdSet.has(record.id));
  const incidents = allRecords.filter(({ recordType }) => recordType === "incident").map(({ record }) => record);
  const evidence = allRecords.filter(({ recordType }) => recordType === "evidence").map(({ record }) => record);
  const documents = allRecords.filter(({ recordType }) => recordType === "document").map(({ record }) => record);
  const strategy = allRecords.filter(({ recordType }) => recordType === "strategy").map(({ record }) => record);
  const ledger = allRecords.filter(({ recordType }) => recordType === "ledger").map(({ record }) => record);
  const questionsAndActions = buildOpenQuestionsAndNextActions(caseItem, strategy, sequenceGroup);
  const chronology = sortChronologyItems(allRecords.map(({ record, recordType }) => buildChronologyItem(record, recordType)));
  const chronologyByDate = groupChronologyItems(chronology);
  const diagnostics = buildThreadDiagnostics(caseItem, sequenceGroup, includedIdSet);
  const diagnosticsSummary = buildDiagnosticsSummary(diagnostics);
  const atAGlance = {
    incidentCount: incidents.length,
    evidenceCount: evidence.length,
    documentCount: documents.length,
    ledgerCount: ledger.length,
    openUnsupportedIncidentCount: diagnosticsSummary.unsupportedIncidentCount,
    keyDiagnosticWarningCount: diagnosticsSummary.warningCount,
  };

  return {
    reportType: THREAD_ISSUE_REPORT,
    title: sequenceGroup ? `Thread / Issue Report: ${sequenceGroup}` : "Thread / Issue Report",
    audience: "general",
    scopeType: "sequenceGroup",
    sequenceGroup,
    sourceCaseId: caseItem?.id || "",
    generatedAt,
    includedRecordIds,
    scopeSummary: sequenceGroup
      ? `Records in sequenceGroup "${sequenceGroup}" plus directly linked records.`
      : "No sequenceGroup selected.",
    caseOverview: {
      name: caseItem?.name || "",
      category: caseItem?.category || "",
      status: caseItem?.status || "",
    },
    atAGlance,
    threadSummary: {
      sequenceGroup,
      incidentCount: incidents.length,
      evidenceCount: evidence.length,
      documentCount: documents.length,
      strategyCount: strategy.length,
      ledgerCount: ledger.length,
    },
    chronology,
    chronologyGroups: chronologyByDate.groups,
    undatedChronology: chronologyByDate.undated,
    incidents: incidents.map((incident) => buildIncident(caseItem, incident)),
    evidence: evidence.map((item) => buildEvidence(caseItem, item)),
    evidenceMatrix: evidence.map((item) => buildEvidence(caseItem, item)),
    documents: documents.map((document) => buildDocument(caseItem, document)),
    ledger: ledger.map((entry) => buildLedger(caseItem, entry)),
    diagnostics,
    diagnosticsSummary,
    openQuestions: questionsAndActions.openQuestions,
    nextActions: questionsAndActions.nextActions,
  };
}

function normalizeEvidencePackScope(scope = {}) {
  const scopeType = scope.scopeType === "sequenceGroup" ? "sequenceGroup" : "case";
  return {
    scopeType,
    sequenceGroup: scopeType === "sequenceGroup" ? compactText(scope.sequenceGroup) : "",
  };
}

function getEvidencePackEvidenceRecords(caseItem = {}, scope = {}) {
  const normalizedScope = normalizeEvidencePackScope(scope);
  const evidence = (caseItem.evidence || []).filter((item) => item?.id);

  if (normalizedScope.scopeType !== "sequenceGroup") return evidence;
  if (!normalizedScope.sequenceGroup) return [];

  const threadReport = buildThreadIssueReport(caseItem, normalizedScope.sequenceGroup, {
    generatedAt: scope.generatedAt,
  });
  const includedIds = new Set(threadReport.includedRecordIds);
  return evidence.filter((item) => includedIds.has(item.id));
}

function buildSupportedIncidents(caseItem = {}, evidenceRecords = []) {
  const evidenceByIncidentId = new Map();
  const includedEvidenceIds = new Set(evidenceRecords.map((item) => item.id));

  evidenceRecords.forEach((evidence) => {
    getEvidenceIncidentIds(caseItem, evidence).forEach((incidentId) => {
      if (!evidenceByIncidentId.has(incidentId)) evidenceByIncidentId.set(incidentId, []);
      evidenceByIncidentId.get(incidentId).push({
        id: evidence.id,
        title: getRecordTitle(evidence, "evidence"),
      });
    });
  });

  (caseItem.incidents || []).forEach((incident) => {
    (incident.linkedEvidenceIds || [])
      .filter((evidenceId) => includedEvidenceIds.has(evidenceId))
      .forEach((evidenceId) => {
        if (!evidenceByIncidentId.has(incident.id)) evidenceByIncidentId.set(incident.id, []);
        if (!evidenceByIncidentId.get(incident.id).some((item) => item.id === evidenceId)) {
          evidenceByIncidentId.get(incident.id).push({
            id: evidenceId,
            title: resolveTitle(caseItem, evidenceId),
          });
        }
      });
  });

  return (caseItem.incidents || [])
    .filter((incident) => evidenceByIncidentId.has(incident.id))
    .map((incident) => {
      const linkedEvidence = evidenceByIncidentId.get(incident.id) || [];
      return {
        id: incident.id,
        title: getRecordTitle(incident, "incident"),
        evidenceStatus: incident.evidenceStatus || "",
        linkedEvidence,
        remainsUnsupported: linkedEvidence.length === 0 || ["needs_evidence", "unverified"].includes(incident.evidenceStatus),
      };
    });
}

function buildEvidencePackDiagnostics(caseItem = {}, evidenceRecords = [], supportedIncidents = []) {
  const diagnostics = analyzeCaseDiagnostics(caseItem || {});
  const evidenceIds = new Set(evidenceRecords.map((item) => item.id));
  const incidentIds = new Set(supportedIncidents.map((item) => item.id));
  return {
    unusedEvidence: (diagnostics.evidenceCoverage?.unusedEvidence || []).filter((item) => evidenceIds.has(item.id)),
    weaklyLinkedEvidence: (diagnostics.integrity?.weaklyLinkedRecords || []).filter((item) => item.type === "evidence" && evidenceIds.has(item.id)),
    brokenLinks: (diagnostics.integrity?.brokenLinks || []).filter((link) => evidenceIds.has(link.sourceId) || evidenceIds.has(link.targetId)),
    unsupportedIncidents: (diagnostics.evidenceCoverage?.incidentsNeedingEvidence || []).filter((item) => incidentIds.has(item.id)),
    warnings: diagnostics.warnings || [],
    suggestions: diagnostics.suggestions || [],
  };
}

export function buildEvidencePackReport(caseItem = {}, scope = {}, options = {}) {
  const normalizedScope = normalizeEvidencePackScope(scope);
  const generatedAt = options.generatedAt || scope.generatedAt || new Date().toISOString();
  const evidenceRecords = getEvidencePackEvidenceRecords(caseItem, { ...normalizedScope, generatedAt });
  const evidenceMatrix = evidenceRecords.map((item) => buildEvidencePackEvidence(caseItem, item));
  const supportedIncidents = buildSupportedIncidents(caseItem, evidenceRecords);
  const linkedEvidence = evidenceMatrix.filter((item) => item.linkedIncidents.length > 0);
  const evidenceMissingFunctionSummary = evidenceMatrix.filter((item) => !compactText(item.functionSummary));
  const evidenceWithAttachments = evidenceMatrix.filter((item) => item.attachmentCount > 0);
  const unlinkedEvidence = evidenceMatrix.filter((item) => item.linkedIncidents.length === 0);
  const evidenceWithoutAttachments = evidenceMatrix.filter((item) => item.attachmentCount === 0);
  const diagnostics = buildEvidencePackDiagnostics(caseItem, evidenceRecords, supportedIncidents);
  const scopeLabel = normalizedScope.scopeType === "sequenceGroup"
    ? `sequenceGroup: ${normalizedScope.sequenceGroup || "-"}`
    : "Whole case";

  return {
    reportType: EVIDENCE_PACK_REPORT,
    title: normalizedScope.scopeType === "sequenceGroup"
      ? `Evidence Pack: ${normalizedScope.sequenceGroup || "Unselected sequenceGroup"}`
      : "Evidence Pack: Whole Case",
    audience: "general",
    scopeType: normalizedScope.scopeType,
    sequenceGroup: normalizedScope.sequenceGroup,
    scopeLabel,
    sourceCaseId: caseItem?.id || "",
    generatedAt,
    includedEvidenceCount: evidenceRecords.length,
    includedEvidenceIds: evidenceRecords.map((item) => item.id),
    caseOverview: {
      name: caseItem?.name || "",
      category: caseItem?.category || "",
      status: caseItem?.status || "",
    },
    atAGlance: {
      evidenceCount: evidenceRecords.length,
      linkedEvidenceCount: linkedEvidence.length,
      unlinkedEvidenceCount: unlinkedEvidence.length,
      incidentsSupportedCount: supportedIncidents.length,
      evidenceWithAttachmentsCount: evidenceWithAttachments.length,
      evidenceMissingFunctionSummaryCount: evidenceMissingFunctionSummary.length,
    },
    evidenceMatrix,
    supportedIncidents,
    unlinkedWeakEvidence: {
      unlinkedEvidence,
      evidenceMissingFunctionSummary,
      evidenceWithoutAttachments,
    },
    diagnostics,
  };
}

function normalizeDocumentPackScope(scope = {}) {
  const scopeType = scope.scopeType === "sequenceGroup" ? "sequenceGroup" : "case";
  return {
    scopeType,
    sequenceGroup: scopeType === "sequenceGroup" ? compactText(scope.sequenceGroup) : "",
  };
}

function getDocumentPackRecords(caseItem = {}, scope = {}) {
  const normalizedScope = normalizeDocumentPackScope(scope);
  const documents = (caseItem.documents || []).filter((item) => item?.id);

  if (normalizedScope.scopeType !== "sequenceGroup") return documents;
  if (!normalizedScope.sequenceGroup) return [];

  const threadReport = buildThreadIssueReport(caseItem, normalizedScope.sequenceGroup, {
    generatedAt: scope.generatedAt,
  });
  const includedIds = new Set(threadReport.includedRecordIds);
  return documents.filter((item) => includedIds.has(item.id));
}

function buildDocumentSupportSummary(documentMatrix = []) {
  const incidentMap = new Map();
  const evidenceMap = new Map();

  documentMatrix.forEach((document) => {
    document.linkedIncidents.forEach((incident) => {
      if (!incidentMap.has(incident.id)) incidentMap.set(incident.id, { ...incident, documents: [] });
      incidentMap.get(incident.id).documents.push({ id: document.id, title: document.title });
    });
    document.linkedEvidence.forEach((evidence) => {
      if (!evidenceMap.has(evidence.id)) evidenceMap.set(evidence.id, { ...evidence, documents: [] });
      evidenceMap.get(evidence.id).documents.push({ id: document.id, title: document.title });
    });
  });

  return {
    linkedIncidents: [...incidentMap.values()],
    linkedEvidence: [...evidenceMap.values()],
  };
}

function buildDocumentPackDiagnostics(caseItem = {}, documentRecords = []) {
  const diagnostics = analyzeCaseDiagnostics(caseItem || {});
  const documentIds = new Set(documentRecords.map((item) => item.id));
  return {
    weaklyLinkedDocuments: (diagnostics.integrity?.weaklyLinkedRecords || []).filter((item) => (
      ["document", "tracking_record"].includes(item.type) && documentIds.has(item.id)
    )),
    orphanDocuments: (diagnostics.integrity?.orphanRecords || []).filter((item) => (
      ["document", "tracking_record"].includes(item.type) && documentIds.has(item.id)
    )),
    brokenLinks: (diagnostics.integrity?.brokenLinks || []).filter((link) => documentIds.has(link.sourceId) || documentIds.has(link.targetId)),
    warnings: diagnostics.warnings || [],
    suggestions: diagnostics.suggestions || [],
  };
}

export function buildDocumentPackReport(caseItem = {}, scope = {}, options = {}) {
  const normalizedScope = normalizeDocumentPackScope(scope);
  const generatedAt = options.generatedAt || scope.generatedAt || new Date().toISOString();
  const documentRecords = getDocumentPackRecords(caseItem, { ...normalizedScope, generatedAt });
  const documentMatrix = documentRecords.map((item) => buildDocumentPackDocument(caseItem, item));
  const linkedDocuments = documentMatrix.filter((item) => item.linkedRecords.length > 0);
  const unlinkedDocuments = documentMatrix.filter((item) => item.linkedRecords.length === 0);
  const documentsWithAttachments = documentMatrix.filter((item) => item.attachmentCount > 0);
  const documentsWithText = documentMatrix.filter((item) => compactText(item.textExcerpt));
  const documentsMissingSummary = documentMatrix.filter((item) => !compactText(item.summary) && !compactText(item.notes) && !compactText(item.functionSummary));
  const diagnostics = buildDocumentPackDiagnostics(caseItem, documentRecords);
  const supportSummary = buildDocumentSupportSummary(documentMatrix);
  const scopeLabel = normalizedScope.scopeType === "sequenceGroup"
    ? `sequenceGroup: ${normalizedScope.sequenceGroup || "-"}`
    : "Whole case";

  return {
    reportType: DOCUMENT_PACK_REPORT,
    title: normalizedScope.scopeType === "sequenceGroup"
      ? `Document Pack: ${normalizedScope.sequenceGroup || "Unselected sequenceGroup"}`
      : "Document Pack: Whole Case",
    audience: "general",
    scopeType: normalizedScope.scopeType,
    sequenceGroup: normalizedScope.sequenceGroup,
    scopeLabel,
    sourceCaseId: caseItem?.id || "",
    generatedAt,
    includedDocumentCount: documentRecords.length,
    includedDocumentIds: documentRecords.map((item) => item.id),
    caseOverview: {
      name: caseItem?.name || "",
      category: caseItem?.category || "",
      status: caseItem?.status || "",
    },
    atAGlance: {
      documentCount: documentRecords.length,
      linkedDocumentCount: linkedDocuments.length,
      unlinkedDocumentCount: unlinkedDocuments.length,
      linkedIncidentCount: supportSummary.linkedIncidents.length,
      linkedEvidenceCount: supportSummary.linkedEvidence.length,
      documentWithAttachmentsCount: documentsWithAttachments.length,
      documentWithTextCount: documentsWithText.length,
      documentMissingSummaryCount: documentsMissingSummary.length,
    },
    documentMatrix,
    supportSummary,
    unlinkedWeakDocuments: {
      unlinkedDocuments,
      documentsMissingSummary,
      documentsWithoutAttachments: documentMatrix.filter((item) => item.attachmentCount === 0),
      documentsWithoutText: documentMatrix.filter((item) => !compactText(item.textExcerpt)),
    },
    diagnostics,
  };
}

function normalizeLedgerPackScope(scope = {}) {
  const scopeType = scope.scopeType === "sequenceGroup" ? "sequenceGroup" : "case";
  return {
    scopeType,
    sequenceGroup: scopeType === "sequenceGroup" ? compactText(scope.sequenceGroup) : "",
  };
}

function getLedgerPackRecords(caseItem = {}, scope = {}) {
  const normalizedScope = normalizeLedgerPackScope(scope);
  const ledger = (caseItem.ledger || []).filter((item) => item?.id);

  if (normalizedScope.scopeType !== "sequenceGroup") return ledger;
  if (!normalizedScope.sequenceGroup) return [];

  const threadReport = buildThreadIssueReport(caseItem, normalizedScope.sequenceGroup, {
    generatedAt: scope.generatedAt,
  });
  const includedIds = new Set(threadReport.includedRecordIds);
  return ledger.filter((item) => includedIds.has(item.id));
}

function sumLedgerAmounts(entries = [], filterFn = () => true) {
  return entries.reduce((total, entry) => {
    if (!filterFn(entry) || entry.amount === null) return total;
    return total + entry.amount;
  }, 0);
}

function buildLedgerProofSummary(ledgerMatrix = []) {
  return {
    entriesLinkedToProofRecords: ledgerMatrix.filter((entry) => (
      entry.linkedEvidence.length > 0 || entry.linkedDocuments.length > 0
    )),
    entriesWithMissingProof: ledgerMatrix.filter((entry) => !entry.hasProof),
  };
}

function buildLedgerPackDiagnostics(caseItem = {}, ledgerRecords = []) {
  const diagnostics = analyzeCaseDiagnostics(caseItem || {});
  const ledgerIds = new Set(ledgerRecords.map((item) => item.id));
  return {
    weaklyLinkedLedger: (diagnostics.integrity?.weaklyLinkedRecords || []).filter((item) => item.type === "ledger" && ledgerIds.has(item.id)),
    orphanLedger: (diagnostics.integrity?.orphanRecords || []).filter((item) => item.type === "ledger" && ledgerIds.has(item.id)),
    brokenLinks: (diagnostics.integrity?.brokenLinks || []).filter((link) => ledgerIds.has(link.sourceId) || ledgerIds.has(link.targetId)),
    warnings: diagnostics.warnings || [],
    suggestions: diagnostics.suggestions || [],
  };
}

export function buildLedgerPackReport(caseItem = {}, scope = {}, options = {}) {
  const normalizedScope = normalizeLedgerPackScope(scope);
  const generatedAt = options.generatedAt || scope.generatedAt || new Date().toISOString();
  const ledgerRecords = getLedgerPackRecords(caseItem, { ...normalizedScope, generatedAt });
  const ledgerMatrix = ledgerRecords.map((item) => buildLedgerPackEntry(caseItem, item));
  const proofSummary = buildLedgerProofSummary(ledgerMatrix);
  const diagnostics = buildLedgerPackDiagnostics(caseItem, ledgerRecords);
  const linkedLedgerEntries = ledgerMatrix.filter((entry) => entry.linkedRecords.length > 0);
  const unlinkedLedgerEntries = ledgerMatrix.filter((entry) => entry.linkedRecords.length === 0);
  const scopeLabel = normalizedScope.scopeType === "sequenceGroup"
    ? `sequenceGroup: ${normalizedScope.sequenceGroup || "-"}`
    : "Whole case";

  return {
    reportType: LEDGER_PACK_REPORT,
    title: normalizedScope.scopeType === "sequenceGroup"
      ? `Ledger Pack: ${normalizedScope.sequenceGroup || "Unselected sequenceGroup"}`
      : "Ledger Pack: Whole Case",
    audience: "general",
    scopeType: normalizedScope.scopeType,
    sequenceGroup: normalizedScope.sequenceGroup,
    scopeLabel,
    sourceCaseId: caseItem?.id || "",
    generatedAt,
    includedLedgerCount: ledgerRecords.length,
    includedLedgerIds: ledgerRecords.map((item) => item.id),
    caseOverview: {
      name: caseItem?.name || "",
      category: caseItem?.category || "",
      status: caseItem?.status || "",
    },
    atAGlance: {
      totalEntryCount: ledgerRecords.length,
      totalAmount: sumLedgerAmounts(ledgerMatrix),
      creditTotal: sumLedgerAmounts(ledgerMatrix, (entry) => entry.direction === "credit"),
      debitTotal: sumLedgerAmounts(ledgerMatrix, (entry) => entry.direction === "debit"),
      entriesWithProofCount: ledgerMatrix.filter((entry) => entry.hasProof).length,
      entriesWithoutProofCount: proofSummary.entriesWithMissingProof.length,
      linkedEntryCount: linkedLedgerEntries.length,
      unlinkedEntryCount: unlinkedLedgerEntries.length,
    },
    ledgerMatrix,
    proofSummary,
    unlinkedWeakLedger: {
      unlinkedLedgerEntries,
      weaklyLinkedLedger: diagnostics.weaklyLinkedLedger,
      entriesWithMissingProof: proofSummary.entriesWithMissingProof,
    },
    diagnostics,
  };
}

const DEFAULT_CASE_BUNDLE_SECTIONS = {
  threadIssue: true,
  evidencePack: true,
  documentPack: true,
  ledgerPack: true,
  strategyActions: true,
  diagnosticsSummary: true,
};

function normalizeCaseBundleScope(scope = {}) {
  const scopeType = scope.scopeType === "sequenceGroup" ? "sequenceGroup" : "case";
  return {
    scopeType,
    sequenceGroup: scopeType === "sequenceGroup" ? compactText(scope.sequenceGroup) : "",
  };
}

function normalizeCaseBundleSections(sections = {}) {
  return {
    ...DEFAULT_CASE_BUNDLE_SECTIONS,
    ...Object.fromEntries(
      Object.keys(DEFAULT_CASE_BUNDLE_SECTIONS).map((key) => [key, sections[key] !== false])
    ),
  };
}

function getScopeIncludedIds(caseItem = {}, normalizedScope = {}, generatedAt = "") {
  if (normalizedScope.scopeType !== "sequenceGroup" || !normalizedScope.sequenceGroup) return null;
  return new Set(buildThreadIssueReport(caseItem, normalizedScope.sequenceGroup, { generatedAt }).includedRecordIds);
}

function buildStrategyActionsSummary(caseItem = {}, normalizedScope = {}, includedIds = null) {
  const includeRecord = (record) => !includedIds || includedIds.has(record.id);
  const strategyRecords = (caseItem.strategy || [])
    .filter((item) => item?.id && includeRecord(item))
    .map((item) => ({
      id: item.id,
      title: getRecordTitle(item, "strategy"),
      status: item.status || "",
      date: item.eventDate || item.date || item.createdAt || "",
      sequenceGroup: item.sequenceGroup || "",
      summary: getSummary(item, "strategy"),
    }));
  const actionSummary = caseItem.actionSummary || {};
  const includeSummaryItem = (value) => (
    normalizedScope.scopeType !== "sequenceGroup" || itemMentionsSequenceGroup(value, normalizedScope.sequenceGroup)
  );

  return {
    strategyRecords,
    actionSummary: {
      currentFocus: safeText(actionSummary.currentFocus),
      nextActions: (Array.isArray(actionSummary.nextActions) ? actionSummary.nextActions : []).filter(includeSummaryItem),
      importantReminders: (Array.isArray(actionSummary.importantReminders) ? actionSummary.importantReminders : []).filter(includeSummaryItem),
      strategyFocus: (Array.isArray(actionSummary.strategyFocus) ? actionSummary.strategyFocus : []).filter(includeSummaryItem),
      criticalDeadlines: (Array.isArray(actionSummary.criticalDeadlines) ? actionSummary.criticalDeadlines : []).filter(includeSummaryItem),
    },
  };
}

function buildCombinedDiagnostics(caseItem = {}, includedIds = null) {
  const diagnostics = analyzeCaseDiagnostics(caseItem || {});
  const includeRecord = (record) => !includedIds || includedIds.has(record?.id);
  const includeLink = (link) => !includedIds || includedIds.has(link.sourceId) || includedIds.has(link.targetId);

  return {
    overview: diagnostics.overview,
    brokenLinks: (diagnostics.integrity?.brokenLinks || []).filter(includeLink),
    orphanRecords: (diagnostics.integrity?.orphanRecords || []).filter(includeRecord),
    weaklyLinkedRecords: (diagnostics.integrity?.weaklyLinkedRecords || []).filter(includeRecord),
    unsupportedIncidents: (diagnostics.evidenceCoverage?.incidentsNeedingEvidence || []).filter(includeRecord),
    unusedEvidence: (diagnostics.evidenceCoverage?.unusedEvidence || []).filter(includeRecord),
    warnings: diagnostics.warnings || [],
    suggestions: diagnostics.suggestions || [],
  };
}

function getExecutiveCurrentPosition(caseItem = {}, diagnostics = {}) {
  const actionSummary = caseItem.actionSummary || {};
  const unsupportedIncidents = diagnostics.evidenceCoverage?.incidentsNeedingEvidence || [];
  const chronologyGaps = diagnostics.chronology?.missingDateRecords || [];
  const mainProblems = [
    ...unsupportedIncidents.slice(0, 3).map((item) => `${item.title} is not yet supported by clear evidence.`),
    ...(diagnostics.evidenceCoverage?.unusedEvidence || []).slice(0, 2).map((item) => `${item.title} is available but not yet tied to an incident.`),
  ];
  const immediateConcerns = [
    ...(unsupportedIncidents.length > 0 ? [`${unsupportedIncidents.length} incident(s) still need stronger proof before the case can be presented cleanly.`] : []),
    ...(chronologyGaps.length > 0 ? [`${chronologyGaps.length} record(s) need dates or ordering to make the timeline reliable.`] : []),
    ...((diagnostics.integrity?.brokenLinks || []).length > 0 ? ["Some record links point to missing items and should be repaired before relying on the file."] : []),
  ];
  const proceduralPosition = shortText(
    caseItem.caseState?.proceduralPosition
    || caseItem.caseState?.currentStage
    || caseItem.status
    || "No procedural position recorded.",
    220,
  );

  return {
    operationalSummary: shortText(
      actionSummary.currentFocus
      || caseItem.caseState?.currentSituation
      || caseItem.caseState?.mainProblem
      || caseItem.description
      || caseItem.notes
      || "No current operational summary recorded.",
      360,
    ),
    proceduralPosition,
    whyItMatters: shortText(
      actionSummary.strategyFocus?.[0]
      || caseItem.caseState?.desiredOutcome
      || (unsupportedIncidents.length > 0
        ? "The case needs clearer proof links before it can be confidently explained or escalated."
        : "The report should keep the current facts, proof, and next steps clear enough for quick action."),
      280,
    ),
    mainProblems,
    immediateConcerns,
    activeIssues: mainProblems.length > 0 ? mainProblems : immediateConcerns,
  };
}

function getExecutiveTimeline(caseItem = {}, diagnostics = {}, limit = 10) {
  const milestoneItems = (diagnostics.milestoneCoverage?.records || []).map((item) => ({
    id: item.id,
    recordType: item.type,
    date: item.date,
      title: item.title,
      summary: "Important milestone in the case timeline.",
      isMilestone: true,
      importanceLabel: "Milestone",
    }));
  const incidentItems = (caseItem.incidents || [])
    .filter((incident) => incident?.id)
    .map((incident) => ({
      id: incident.id,
      recordType: "incident",
      date: getRecordDate(incident),
      title: getRecordTitle(incident, "incident"),
      summary: getSummary(incident, "incident"),
      isMilestone: !!incident.isMilestone,
      importanceLabel: incident.isMilestone ? "Milestone" : "Incident",
    }));
  const deadlineItems = (Array.isArray(caseItem.actionSummary?.criticalDeadlines) ? caseItem.actionSummary.criticalDeadlines : [])
    .map((deadline, index) => ({
      id: `deadline-${index}`,
      recordType: "deadline",
      date: "",
      title: shortText(deadline, 120) || `Deadline ${index + 1}`,
      summary: "Critical deadline or time-sensitive item.",
      isMilestone: false,
      importanceLabel: "Deadline",
    }));
  const seen = new Set();
  const combined = [...milestoneItems, ...incidentItems, ...deadlineItems]
    .filter((item) => {
      const key = `${item.recordType}:${item.id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => {
      if (a.date && b.date && a.date !== b.date) return b.date.localeCompare(a.date);
      if (a.date && !b.date) return -1;
      if (!a.date && b.date) return 1;
      if (a.isMilestone !== b.isMilestone) return a.isMilestone ? -1 : 1;
      return String(a.title || "").localeCompare(String(b.title || ""));
    });
  return combined.slice(0, limit);
}

function scoreExecutiveEvidence(evidence = {}, caseItem = {}) {
  const linkedIncidentCount = getEvidenceIncidentIds(caseItem, evidence).length;
  const attachmentCount = Array.isArray(evidence.attachments) ? evidence.attachments.length : 0;
  const importance = safeText(evidence.importance).toLowerCase();
  const status = safeText(evidence.status).toLowerCase();
  const role = safeText(evidence.evidenceRole).toLowerCase();
  let score = 0;
  if (["critical", "high", "key"].includes(importance)) score += 4;
  if (status === "verified") score += 3;
  if (role.includes("anchor")) score += 3;
  if (safeText(evidence.functionSummary)) score += 2;
  score += Math.min(linkedIncidentCount, 3);
  if (attachmentCount > 0) score += 1;
  return score;
}

function getExecutiveEvidence(caseItem = {}, limit = 6) {
  return (caseItem.evidence || [])
    .filter((evidence) => evidence?.id)
    .map((evidence) => {
      const built = buildEvidencePackEvidence(caseItem, evidence);
      const linkedIncidentTitles = built.linkedIncidents.map((item) => item.title).filter(Boolean);
      return {
        ...built,
        importance: evidence.importance || "",
        score: scoreExecutiveEvidence(evidence, caseItem),
        whyItMatters: shortText(
          built.functionSummary
          || (linkedIncidentTitles.length > 0 ? `Supports ${linkedIncidentTitles.join(", ")}.` : "")
          || "This item may help explain or support the case once its role is clarified.",
          240,
        ),
        supports: linkedIncidentTitles,
      };
    })
    .sort((a, b) => {
      if (a.score !== b.score) return b.score - a.score;
      const dateCompare = String(b.capturedAt || b.date || "").localeCompare(String(a.capturedAt || a.date || ""));
      if (dateCompare !== 0) return dateCompare;
      return a.title.localeCompare(b.title);
    })
    .slice(0, limit);
}

function getExecutiveRisksAndConcerns(diagnostics = {}) {
  const risks = [];
  if ((diagnostics.evidenceCoverage?.incidentsNeedingEvidence || []).length > 0) {
    risks.push({
      id: "missing-proof",
      title: "Proof is not complete",
      message: `${diagnostics.evidenceCoverage.incidentsNeedingEvidence.length} incident(s) still need stronger evidence before the case can be presented confidently.`,
      source: "evidence",
    });
  }
  if ((diagnostics.integrity?.weaklyLinkedRecords || []).length > 0) {
    risks.push({
      id: "weak-links",
      title: "Some material is not connected to the case story",
      message: "Some records are present but not clearly tied to incidents, evidence, documents, or ledger entries.",
      source: "linking",
    });
  }
  if ((diagnostics.chronology?.missingDateRecords || []).length > 0) {
    risks.push({
      id: "chronology-gaps",
      title: "The timeline needs tightening",
      message: `${diagnostics.chronology.missingDateRecords.length} record(s) need dates or clearer ordering.`,
      source: "chronology",
    });
  }
  const weakGroups = (diagnostics.sequenceGroups?.groups || []).filter((group) =>
    (group.counts?.incident || 0) === 0 || ((group.counts?.incident || 0) > 0 && (group.counts?.evidence || 0) === 0)
  );
  if (weakGroups.length > 0) {
    risks.push({
      id: "weak-sequence-groups",
      title: "Some issue threads are thin",
      message: `${weakGroups.length} issue thread(s) need clearer incident and evidence structure.`,
      source: "sequenceGroup",
    });
  }
  (diagnostics.risks || []).slice(0, 2).forEach((item) => {
    if (!risks.some((risk) => risk.id === item.id)) {
      risks.push({ id: item.id, title: "Case file issue", message: item.message, source: "risk" });
    }
  });
  return risks.slice(0, 12);
}

function getExecutiveRecommendedNextSteps(caseItem = {}, diagnostics = {}) {
  const actionSummary = caseItem.actionSummary || {};
  const actionItems = (Array.isArray(actionSummary.nextActions) ? actionSummary.nextActions : [])
    .map((text, index) => ({ id: `action-${index}`, source: "actionSummary", text }));
  const strategyItems = (caseItem.strategy || [])
    .filter((item) => item?.id && !["done", "closed", "archived"].includes(item.status))
    .slice(0, 5)
    .map((item) => ({
      id: item.id,
      source: "strategy",
      text: getSummary(item, "strategy") || getRecordTitle(item, "strategy"),
    }));
  const diagnosticItems = [
    ...(diagnostics.suggestions || []),
    ...(diagnostics.evidenceCoverage?.incidentsNeedingEvidence || []).map((item) => ({
      id: `support-${item.id}`,
      message: `Find or link evidence for ${item.title}.`,
    })),
  ].slice(0, 5).map((item) => ({
    id: item.id,
    source: "diagnostics",
    text: item.message,
  }));
  return [...actionItems, ...strategyItems, ...diagnosticItems]
    .filter((item) => compactText(item.text))
    .slice(0, 12)
    .map((item, index) => ({
      ...item,
      priority: index < 3 ? "high" : "normal",
    }));
}

function getExecutiveSequenceGroupOverview(diagnostics = {}) {
  return (diagnostics.sequenceGroups?.groups || []).map((group) => {
    const warnings = [];
    if ((group.counts?.incident || 0) === 0) warnings.push("No incidents");
    if ((group.counts?.incident || 0) > 0 && (group.counts?.evidence || 0) === 0) warnings.push("Incidents without evidence");
    return {
      name: group.name,
      totalCount: group.totalCount,
      counts: { ...group.counts },
      warnings,
    };
  });
}

export function buildExecutiveSummaryReport(caseItem = {}, options = {}) {
  const generatedAt = options.generatedAt || new Date().toISOString();
  const diagnostics = analyzeCaseDiagnostics(caseItem || {});
  const sequenceGroupOverview = getExecutiveSequenceGroupOverview(diagnostics);
  const milestones = diagnostics.milestoneCoverage?.records || [];

  return {
    reportType: EXECUTIVE_SUMMARY_REPORT,
    title: "Executive Summary",
    audience: "general",
    sourceCaseId: caseItem?.id || "",
    generatedAt,
    caseOverview: {
      name: caseItem?.name || "",
      category: caseItem?.category || "",
      status: caseItem?.status || "",
      createdAt: caseItem?.createdAt || "",
      updatedAt: caseItem?.updatedAt || "",
      description: shortText(caseItem?.description || caseItem?.notes || "", 420),
    },
    currentPosition: getExecutiveCurrentPosition(caseItem, diagnostics),
    atAGlance: {
      incidentCount: (caseItem.incidents || []).length,
      evidenceCount: (caseItem.evidence || []).length,
      documentCount: (caseItem.documents || []).length,
      weakUnlinkedRecordCount: (diagnostics.integrity?.weaklyLinkedRecords || []).length + (diagnostics.integrity?.orphanRecords || []).length,
      sequenceGroupCount: sequenceGroupOverview.length,
      milestoneCount: milestones.length,
      openIssueCount: (diagnostics.openIssues?.openTaskCount || 0)
        + (diagnostics.openIssues?.openStrategyCount || 0)
        + (diagnostics.openIssues?.unsupportedIncidentCount || 0)
        + (diagnostics.openIssues?.unusedEvidenceCount || 0),
    },
    keyTimeline: getExecutiveTimeline(caseItem, diagnostics, options.timelineLimit || 10),
    strongestEvidence: getExecutiveEvidence(caseItem, options.evidenceLimit || 6),
    missingEvidence: diagnostics.evidenceCoverage?.incidentsNeedingEvidence || [],
    risksAndConcerns: getExecutiveRisksAndConcerns(diagnostics),
    recommendedNextSteps: getExecutiveRecommendedNextSteps(caseItem, diagnostics),
    sequenceGroupOverview,
    diagnosticsSummary: {
      unsupportedIncidentCount: diagnostics.evidenceCoverage?.incidentsNeedingEvidence?.length || 0,
      unusedEvidenceCount: diagnostics.evidenceCoverage?.unusedEvidence?.length || 0,
      chronologyGapCount: diagnostics.chronology?.missingDateRecords?.length || 0,
      brokenLinkCount: diagnostics.integrity?.brokenLinks?.length || 0,
      weaklyLinkedRecordCount: diagnostics.integrity?.weaklyLinkedRecords?.length || 0,
    },
  };
}

function buildBundleContentsSummary(selectedSections, sections) {
  return [
    {
      key: "threadIssue",
      label: "Thread / Issue Report",
      selected: selectedSections.threadIssue,
      included: !!sections.threadIssue,
      itemCount: sections.threadIssue?.includedRecordIds?.length || 0,
      unavailableReason: selectedSections.threadIssue && !sections.threadIssue ? "Requires sequenceGroup scope." : "",
    },
    {
      key: "evidencePack",
      label: "Evidence Pack",
      selected: selectedSections.evidencePack,
      included: !!sections.evidencePack,
      itemCount: sections.evidencePack?.includedEvidenceCount || 0,
    },
    {
      key: "documentPack",
      label: "Document Pack",
      selected: selectedSections.documentPack,
      included: !!sections.documentPack,
      itemCount: sections.documentPack?.includedDocumentCount || 0,
    },
    {
      key: "ledgerPack",
      label: "Ledger Pack",
      selected: selectedSections.ledgerPack,
      included: !!sections.ledgerPack,
      itemCount: sections.ledgerPack?.includedLedgerCount || 0,
    },
    {
      key: "strategyActions",
      label: "Strategy / Actions Summary",
      selected: selectedSections.strategyActions,
      included: !!sections.strategyActions,
      itemCount: sections.strategyActions?.strategyRecords?.length || 0,
    },
    {
      key: "diagnosticsSummary",
      label: "Diagnostics Summary",
      selected: selectedSections.diagnosticsSummary,
      included: !!sections.combinedDiagnostics,
      itemCount: (sections.combinedDiagnostics?.warnings?.length || 0) + (sections.combinedDiagnostics?.brokenLinks?.length || 0),
    },
  ];
}

export function buildCaseBundleReport(caseItem = {}, scope = {}, options = {}) {
  const normalizedScope = normalizeCaseBundleScope(scope);
  const selectedSections = normalizeCaseBundleSections(options.sections || scope.sections || {});
  const generatedAt = options.generatedAt || scope.generatedAt || new Date().toISOString();
  const childScope = { ...normalizedScope, generatedAt };
  const includedIds = getScopeIncludedIds(caseItem, normalizedScope, generatedAt);
  const sections = {
    threadIssue: selectedSections.threadIssue && normalizedScope.scopeType === "sequenceGroup" && normalizedScope.sequenceGroup
      ? buildThreadIssueReport(caseItem, normalizedScope.sequenceGroup, { generatedAt })
      : null,
    evidencePack: selectedSections.evidencePack ? buildEvidencePackReport(caseItem, childScope, { generatedAt }) : null,
    documentPack: selectedSections.documentPack ? buildDocumentPackReport(caseItem, childScope, { generatedAt }) : null,
    ledgerPack: selectedSections.ledgerPack ? buildLedgerPackReport(caseItem, childScope, { generatedAt }) : null,
    strategyActions: selectedSections.strategyActions ? buildStrategyActionsSummary(caseItem, normalizedScope, includedIds) : null,
    combinedDiagnostics: selectedSections.diagnosticsSummary ? buildCombinedDiagnostics(caseItem, includedIds) : null,
  };
  const scopeLabel = normalizedScope.scopeType === "sequenceGroup"
    ? `sequenceGroup: ${normalizedScope.sequenceGroup || "-"}`
    : "Whole case";

  return {
    reportType: CASE_BUNDLE_REPORT,
    title: normalizedScope.scopeType === "sequenceGroup"
      ? `Case Bundle: ${normalizedScope.sequenceGroup || "Unselected sequenceGroup"}`
      : "Case Bundle: Whole Case",
    audience: "general",
    scopeType: normalizedScope.scopeType,
    sequenceGroup: normalizedScope.sequenceGroup,
    scopeLabel,
    sourceCaseId: caseItem?.id || "",
    generatedAt,
    selectedSections,
    contentsSummary: buildBundleContentsSummary(selectedSections, sections),
    sections,
    caseOverview: {
      name: caseItem?.name || "",
      category: caseItem?.category || "",
      status: caseItem?.status || "",
    },
    generationMetadata: {
      deterministic: true,
      generatedBy: "Report Builder V2",
      sectionCount: Object.values(sections).filter(Boolean).length,
    },
  };
}
