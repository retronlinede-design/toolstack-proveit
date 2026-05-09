import { analyzeCaseDiagnostics, analyzeSequenceGroup } from "../diagnostics/caseDiagnostics.js";
import { resolveRecordById } from "../domain/linkingResolvers.js";

export const THREAD_ISSUE_REPORT = "THREAD_ISSUE_REPORT";

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
