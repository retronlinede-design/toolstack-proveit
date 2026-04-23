import { getCaseHealthReport } from "../lib/caseHealth.js";
import { getIncidentLinkGroups, sortTimelineItems } from "../domain/caseDomain.js";
import { getEvidenceDisplayMeta, getIncidentDisplayMeta, getRecordDisplayMeta } from "../domain/linkingResolvers.js";

/**
 * Sanitizes an attachment object for export, removing binary data.
 */
export function sanitizeAttachmentForExport(att) {
  if (!att) return att;
  return {
    id: att.id,
    name: att.name,
    type: att.type,
    mimeType: att.mimeType,
    size: att.size,
    kind: att.kind,
    createdAt: att.createdAt,
    emailMeta: att.emailMeta ?? null,
    storage: att.storage
  };
}

/**
 * Sanitizes a record object for export, removing binary data from attachments.
 */
export function sanitizeRecordForExport(record) {
  if (!record) return record;
  const attachments = Array.isArray(record.attachments)
    ? record.attachments.map(sanitizeAttachmentForExport)
    : [];
  return {
    ...record,
    attachments,
    availability: record.availability
      ? {
          ...record.availability,
          digital: record.availability.digital
            ? {
                ...record.availability.digital,
                files: Array.isArray(record.availability.digital.files)
                  ? record.availability.digital.files.map(sanitizeAttachmentForExport)
                  : []
              }
            : record.availability.digital
        }
      : record.availability
  };
}

/**
 * Sanitizes a case object for export, removing binary data from all nested attachments.
 */
export function sanitizeCaseForExport(caseItem) {
  if (!caseItem) return caseItem;
  return {
    ...caseItem,
    evidence: Array.isArray(caseItem.evidence) ? caseItem.evidence.map(sanitizeRecordForExport) : [],
    incidents: Array.isArray(caseItem.incidents) ? caseItem.incidents.map(sanitizeRecordForExport) : [],
    tasks: Array.isArray(caseItem.tasks) ? caseItem.tasks.map(sanitizeRecordForExport) : [],
    strategy: Array.isArray(caseItem.strategy) ? caseItem.strategy.map(sanitizeRecordForExport) : [],
    ledger: Array.isArray(caseItem.ledger) ? caseItem.ledger.map(item => ({ ...item })) : [],
    documents: Array.isArray(caseItem.documents)
      ? caseItem.documents.map(item => ({
          ...item,
          attachments: Array.isArray(item.attachments)
            ? item.attachments.map(sanitizeAttachmentForExport)
            : [],
        }))
      : [],
    actionSummary: caseItem?.actionSummary
      ? {
          currentFocus: caseItem.actionSummary.currentFocus || "",
          nextActions: Array.isArray(caseItem.actionSummary.nextActions) ? caseItem.actionSummary.nextActions : [],
          importantReminders: Array.isArray(caseItem.actionSummary.importantReminders) ? caseItem.actionSummary.importantReminders : [],
          strategyFocus: Array.isArray(caseItem.actionSummary.strategyFocus) ? caseItem.actionSummary.strategyFocus : [],
          criticalDeadlines: Array.isArray(caseItem.actionSummary.criticalDeadlines) ? caseItem.actionSummary.criticalDeadlines : [],
          updatedAt: caseItem.actionSummary.updatedAt || "",
        }
      : {
          currentFocus: "",
          nextActions: [],
          importantReminders: [],
          strategyFocus: [],
          criticalDeadlines: [],
          updatedAt: "",
        },
  };
}

export function buildCaseReasoningExportPayload(caseItem, mode = "compact") {
  if (!caseItem) {
    throw new Error("caseItem is required for CASE_REASONING_EXPORT");
  }

  const c = sanitizeCaseForExport(caseItem);
  const health = getCaseHealthReport(c);
  const limits = mode === "compact"
    ? { timeline: 5, facts: 8, tasks: 8, ledger: 10, chronology: 20 }
    : { timeline: 12, facts: 12, tasks: 12, ledger: 25, chronology: 50 };

  const mapImportance = (val) => {
    const v = String(val || "").toLowerCase();
    if (v === "critical") return "high";
    if (v === "strong") return "medium";
    return "low";
  };

  const openTasks = (c.tasks || [])
    .filter(t => t.status !== "done")
    .slice(0, limits.tasks)
    .map(t => {
      const linkedRecordIds = Array.isArray(t.linkedRecordIds) ? t.linkedRecordIds : [];
      const linkedRecords = linkedRecordIds
        .map((recordId) => getRecordDisplayMeta(c, recordId))
        .filter(Boolean)
        .map((record) => ({
          id: record.id,
          recordType: record.recordType,
          title: record.title || "",
          date: record.date || "",
        }));

      return {
        id: t.id,
        title: t.title,
        status: t.status,
        priority: t.priority || "medium",
        description: t.description || "",
        linkedRecordIds,
        linkedRecords,
        resolvedLinks: {
          records: linkedRecords,
        },
      };
    });

  const activeIssues = [
    ...(c.incidents || []).map(item => ({ item, recordType: "incident" })),
    ...(c.evidence || []).map(item => ({ item, recordType: "evidence" })),
  ]
    .filter(({ item }) => (item.status !== "verified" && item.status !== "archived") || item.importance === "critical")
    .slice(0, limits.facts)
    .map(({ item, recordType }) => ({
      id: item.id,
      recordType,
      title: item.title,
      status: item.status,
      importance: mapImportance(item.importance),
      summary: (item.description || item.notes || "").substring(0, 200),
    }));

  const recentTimeline = sortTimelineItems([...(c.incidents || []), ...(c.evidence || [])])
    .reverse()
    .slice(0, limits.timeline)
    .map(t => ({
      id: t.id,
      type: t.type,
      date: t.eventDate || t.date,
      title: t.title,
      description: t.description ? t.description.substring(0, 300) : "",
    }));
  const milestoneTimeline = sortTimelineItems(
    (c.incidents || []).filter((incident) => !!incident?.isMilestone)
  ).map((incident) => ({
    id: incident.id,
    date: incident.eventDate || incident.date || "",
    title: incident.title || "",
    summary: ((incident.description || incident.summary || "").substring(0, 220)).trim(),
  }));

  const resolveLinkedRecords = (linkedRecordIds, mapper) => (Array.isArray(linkedRecordIds) ? linkedRecordIds : [])
    .map((recordId) => getRecordDisplayMeta(c, recordId))
    .filter(Boolean)
    .map(mapper);
  const resolveLinkedIncidents = (linkedIncidentIds, mapper) => (Array.isArray(linkedIncidentIds) ? linkedIncidentIds : [])
    .map((incidentId) => getIncidentDisplayMeta(c, incidentId))
    .filter(Boolean)
    .map(mapper);
  const mapResolvedRecord = (record) => ({
    id: record.id,
    title: record.title || "",
    recordType: record.recordType,
    summary: (record.summary || "").substring(0, 300),
    date: record.date || "",
  });
  const mapResolvedIncident = (incident) => ({
    id: incident.id,
    title: incident.title || "",
    date: incident.date || "",
    recordType: incident.recordType,
    summary: (incident.summary || "").substring(0, 300),
  });
  const mapResolvedEvidence = (evidence) => ({
    id: evidence.id,
    title: evidence.title || "",
    date: evidence.date || evidence.record?.capturedAt || "",
    status: evidence.record?.status,
    importance: evidence.record?.importance,
    relevance: evidence.record?.relevance,
    evidenceRole: evidence.record?.evidenceRole,
    recordType: evidence.recordType,
    summary: (evidence.summary || "").substring(0, 300),
  });

  const incidentSummary = sortTimelineItems(c.incidents || [])
    .reverse()
    .slice(0, limits.timeline)
    .map(i => {
      const incidentLinks = getIncidentLinkGroups(c, i.id);
      const linkedEvidenceIds = Array.isArray(i.linkedEvidenceIds) ? i.linkedEvidenceIds : [];
      const linkedRecordIds = Array.isArray(i.linkedRecordIds) ? i.linkedRecordIds : [];
      const linkedIncidentRefs = Array.isArray(i.linkedIncidentRefs) ? i.linkedIncidentRefs : [];
      const mapLinkedIncident = ({ incident }) => getIncidentDisplayMeta(c, incident.id);
      const linkedRecords = resolveLinkedRecords(linkedRecordIds, mapResolvedRecord);
      const linkedEvidence = linkedEvidenceIds
        .map((evidenceId) => getEvidenceDisplayMeta(c, evidenceId))
        .filter(Boolean)
        .map(mapResolvedEvidence);
      const resolvedIncidentLinks = {
        causes: incidentLinks.causes.map(mapLinkedIncident).filter(Boolean).map(mapResolvedIncident),
        outcomes: incidentLinks.outcomes.map(mapLinkedIncident).filter(Boolean).map(mapResolvedIncident),
        related: incidentLinks.related.map(mapLinkedIncident).filter(Boolean).map(mapResolvedIncident),
      };

      return {
        id: i.id,
        title: i.title,
        status: i.status,
        importance: i.importance,
        date: i.eventDate || i.date || "",
        summary: (i.description || i.notes || "").substring(0, 300),
        linkedIncidentRefs,
        linkedRecordIds,
        linkedRecords,
        linkedEvidenceIds,
        linkedEvidence,
        incidentLinks: {
          causes: resolvedIncidentLinks.causes.map(({ id, title, date }) => ({ id, title, date })),
          outcomes: resolvedIncidentLinks.outcomes.map(({ id, title, date }) => ({ id, title, date })),
          related: resolvedIncidentLinks.related.map(({ id, title, date }) => ({ id, title, date })),
        },
        resolvedLinks: {
          records: linkedRecords,
          evidence: linkedEvidence,
          incidents: resolvedIncidentLinks,
        },
      };
    });

  const normalizeLevel = (value) => {
    const v = String(value || "").toLowerCase();
    if (v === "high" || v === "critical") return "high";
    if (v === "medium" || v === "strong") return "medium";
    return "low";
  };

  const evidenceCount = (c.evidence || []).length;
  const documentCount = (c.documents || []).length;
  const currentRiskLevel = activeIssues.some(i => normalizeLevel(i.importance) === "high")
    ? "high"
    : activeIssues.length > 0 || openTasks.length > 3
      ? "medium"
      : "low";
  const confidenceLevel = evidenceCount >= 5 || documentCount >= 5
    ? "high"
    : evidenceCount >= 2 || documentCount >= 2
      ? "medium"
      : "low";
  const strategyCurrent = (c.strategy || [])
    .filter(s => s && s.title)
    .slice(0, 5)
    .map(s => {
      const linkedRecordIds = Array.isArray(s.linkedRecordIds) ? s.linkedRecordIds : [];
      const linkedRecords = resolveLinkedRecords(linkedRecordIds, (record) => ({
        id: record.id,
        recordType: record.recordType,
        title: record.title || "",
        date: record.date || "",
      }));

      return {
        id: s.id,
        title: s.title,
        status: s.status,
        date: s.eventDate || s.date || "",
        summary: (s.description || s.notes || "").substring(0, 300),
        linkedRecordIds,
        linkedRecords,
        resolvedLinks: {
          records: linkedRecords,
        },
      };
    });
  const caseState = {
    currentSituation: `${c.status || "open"} case with ${(c.incidents || []).length} incidents, ${evidenceCount} evidence items, ${documentCount} documents, and ${openTasks.length} open tasks.`,
    mainProblem: (
      activeIssues[0]?.summary ||
      activeIssues[0]?.title ||
      incidentSummary[0]?.summary ||
      incidentSummary[0]?.title ||
      "Main problem not yet summarized."
    ).substring(0, 220),
    currentLeverage: (
      strategyCurrent[0]?.title ||
      activeIssues[0]?.title ||
      "No clear leverage point identified yet."
    ).substring(0, 180),
    currentRiskLevel,
    confidenceLevel,
  };
  const riskSummary = [
    ...activeIssues.map(item => {
      const severity = normalizeLevel(item.importance);
      return {
        type: item.status || "issue",
        description: (item.summary || item.title || "").substring(0, 220),
        severity,
        urgency: severity === "high" ? "high" : severity === "medium" ? "medium" : "low",
      };
    }),
    ...openTasks.map(task => {
      const urgency = normalizeLevel(task.priority);
      return {
        type: "task",
        description: (task.description || task.title || "").substring(0, 220),
        severity: urgency,
        urgency,
      };
    }),
  ].slice(0, 5);
  const leveragePoints = [
    ...strategyCurrent.map(s => {
      const hasLinkedRecords = Array.isArray(s.linkedRecordIds) && s.linkedRecordIds.length > 0;
      const hasSummary = !!s.summary;
      return {
        title: s.title,
        description: s.summary.substring(0, 220),
        strength: hasLinkedRecords || hasSummary ? "high" : s.title ? "medium" : "low",
        usableNow: s.status !== "archived",
      };
    }),
    ...(strategyCurrent.length > 0
      ? []
      : (c.incidents || []).slice(0, limits.facts).map(i => ({
          title: i.title,
          description: (i.description || i.notes || "").substring(0, 220),
          strength: i.title ? "medium" : "low",
          usableNow: true,
        }))),
  ].slice(0, 5);
  const evidenceSummary = (c.evidence || []).map(e => ({
    id: e.id,
    title: e.title,
    status: e.status,
    importance: e.importance,
    relevance: e.relevance,
    sourceType: e.sourceType,
    summary: (e.description || e.notes || "").substring(0, 300),
    attachmentCount: Array.isArray(e.attachments) ? e.attachments.length : 0,
    evidenceRole: e.evidenceRole,
    sequenceGroup: e.sequenceGroup || "",
    functionSummary: e.functionSummary || "",
    linkedIncidentIds: Array.isArray(e.linkedIncidentIds) ? e.linkedIncidentIds : [],
    linkedIncidents: resolveLinkedIncidents(e.linkedIncidentIds, (incident) => ({
      id: incident.id,
      title: incident.title || "",
      date: incident.date || "",
    })),
    resolvedLinks: {
      incidents: resolveLinkedIncidents(e.linkedIncidentIds, mapResolvedIncident),
    },
  }));
  const toLedgerNumber = (value) => {
    const parsed = Number(value || 0);
    return Number.isFinite(parsed) ? parsed : 0;
  };
  const ledgerEntries = Array.isArray(c.ledger) ? c.ledger : [];
  const normalizeLinkedRecordIds = (value) => Array.isArray(value) ? value : [];
  const buildChronologyItem = (record, recordType, date, title, summary, linkedRecordIds) => {
    const normalizedLinkedRecordIds = normalizeLinkedRecordIds(linkedRecordIds);
    const linkedRecords = resolveLinkedRecords(normalizedLinkedRecordIds, (resolvedRecord) => ({
      id: resolvedRecord.id,
      recordType: resolvedRecord.recordType,
      title: resolvedRecord.title || "",
      date: resolvedRecord.date || "",
    }));

    return {
      id: record?.id,
      recordType,
      date: date || "",
      title: title || "",
      summary: (summary || "").substring(0, 300),
      linkedRecordIds: normalizedLinkedRecordIds,
      linkedRecords,
      resolvedLinks: {
        records: linkedRecords,
      },
    };
  };
  const chronologySourceItems = [
    ...(c.incidents || []).map((item) => buildChronologyItem(
      item,
      "incident",
      item.eventDate || item.date,
      item.title,
      item.description || item.notes,
      item.linkedRecordIds
    )),
    ...(c.evidence || []).map((item) => buildChronologyItem(
      item,
      "evidence",
      item.eventDate || item.date || item.capturedAt,
      item.title,
      item.description || item.notes,
      item.linkedRecordIds
    )),
    ...(c.documents || []).map((item) => buildChronologyItem(
      item,
      "document",
      item.documentDate || item.createdAt,
      item.title,
      item.summary || item.textContent,
      item.linkedRecordIds
    )),
    ...(c.strategy || []).map((item) => buildChronologyItem(
      item,
      "strategy",
      item.eventDate || item.date,
      item.title,
      item.description || item.notes,
      item.linkedRecordIds
    )),
    ...(c.tasks || []).map((item) => buildChronologyItem(
      item,
      "task",
      item.dueDate || item.date || item.createdAt,
      item.title,
      item.description || item.notes,
      item.linkedRecordIds
    )),
    ...ledgerEntries.map((item) => buildChronologyItem(
      item,
      "ledger",
      item.paymentDate || item.dueDate || item.period || item.createdAt,
      item.label,
      item.notes,
      item.linkedRecordIds
    )),
  ];
  const chronology = {
    totalItems: chronologySourceItems.length,
    items: [...chronologySourceItems]
      .sort((a, b) => {
        const dateCompare = String(b.date || "").localeCompare(String(a.date || ""));
        if (dateCompare !== 0) return dateCompare;
        return String(a.id || "").localeCompare(String(b.id || ""));
      })
      .slice(0, limits.chronology),
  };
  const ledgerSummary = {
    totals: ledgerEntries.reduce((totals, entry) => {
      const expectedAmount = toLedgerNumber(entry?.expectedAmount);
      const paidAmount = toLedgerNumber(entry?.paidAmount);
      const differenceAmount = Object.prototype.hasOwnProperty.call(entry || {}, "differenceAmount")
        ? toLedgerNumber(entry?.differenceAmount)
        : expectedAmount - paidAmount;
      const currency = entry?.currency || "";

      totals.expectedTotal += expectedAmount;
      totals.paidTotal += paidAmount;
      totals.differenceTotal += differenceAmount;
      if (currency && !totals.currencies.includes(currency)) totals.currencies.push(currency);

      return totals;
    }, {
      entryCount: ledgerEntries.length,
      expectedTotal: 0,
      paidTotal: 0,
      differenceTotal: 0,
      currencies: [],
    }),
    entries: ledgerEntries.slice(0, limits.ledger).map((entry) => {
      const expectedAmount = toLedgerNumber(entry?.expectedAmount);
      const paidAmount = toLedgerNumber(entry?.paidAmount);
      const differenceAmount = Object.prototype.hasOwnProperty.call(entry || {}, "differenceAmount")
        ? toLedgerNumber(entry?.differenceAmount)
        : expectedAmount - paidAmount;

      return {
        id: entry?.id,
        category: entry?.category,
        label: entry?.label,
        period: entry?.period,
        expectedAmount,
        paidAmount,
        differenceAmount,
        currency: entry?.currency,
        dueDate: entry?.dueDate,
        paymentDate: entry?.paymentDate,
        status: entry?.status,
        proofStatus: entry?.proofStatus,
        counterparty: entry?.counterparty,
        notes: entry?.notes,
        linkedRecordIds: Array.isArray(entry?.linkedRecordIds) ? entry.linkedRecordIds : [],
        linkedRecords: resolveLinkedRecords(entry?.linkedRecordIds, (record) => ({
          id: record.id,
          recordType: record.recordType,
          title: record.title || "",
          date: record.date || "",
        })),
        resolvedLinks: {
          records: resolveLinkedRecords(entry?.linkedRecordIds, (record) => ({
            id: record.id,
            recordType: record.recordType,
            title: record.title || "",
            date: record.date || "",
          })),
        },
      };
    }),
  };
  const documentSummary = (c.documents || []).map(d => {
    const linkedRecords = resolveLinkedRecords(d.linkedRecordIds, (record) => ({
      id: record.id,
      recordType: record.recordType,
      title: record.title || "",
      date: record.date || "",
    }));

    return {
      id: d.id,
      title: d.title,
      category: d.category,
      documentDate: d.documentDate,
      source: d.source,
      summary: d.summary || "",
      hasTextContent: !!d.textContent,
      textExcerpt: typeof d.textContent === "string" ? d.textContent.substring(0, 1000) : "",
      attachmentCount: Array.isArray(d.attachments) ? d.attachments.length : 0,
      attachmentNames: Array.isArray(d.attachments)
        ? d.attachments.map((att) => att?.name || att?.fileName || "").filter(Boolean)
        : [],
      linkedRecordIds: Array.isArray(d.linkedRecordIds) ? d.linkedRecordIds : [],
      linkedRecords,
      resolvedLinks: {
        records: linkedRecords,
      },
    };
  });
  const allHealthIssues = (health.issues || []).flatMap(group =>
    (group.items || []).map(item => ({
      id: item.id,
      category: group.category,
      title: item.title || "Issue",
      detail: item.detail || "",
      severity: item.severity || "blocking",
      type: item.type || "",
      tab: item.tab || "",
      date: item.date || "",
    }))
  );
  const advisoryIssueCount = allHealthIssues.filter(item => item.severity === "advisory").length;
  const blockingIssues = allHealthIssues.filter(item => item.severity !== "advisory");
  const topBlockers = blockingIssues.slice(0, 10);
  const readiness = {
    status: health.status,
    blockingIssueCount: health.totalIssues,
    advisoryIssueCount,
    totals: health.totals,
    summary:
      health.totalIssues > 0
        ? `${health.totalIssues} blocking readiness issue(s).`
        : "No blocking readiness issues detected.",
  };
  const blockers = topBlockers;
  const evidencePosture = {
    confidenceLevel,
    evidenceCount,
    documentCount,
    evidenceWithAttachments: (c.evidence || []).filter(e => Array.isArray(e.attachments) && e.attachments.length > 0).length,
    documentsWithAttachments: (c.documents || []).filter(d => Array.isArray(d.attachments) && d.attachments.length > 0).length,
    summary: `${evidenceCount} evidence item(s), ${documentCount} document(s), confidence ${confidenceLevel}.`,
    evidence: evidenceSummary,
    documents: documentSummary,
  };

  return {
    app: "proveit",
    contractVersion: "2.0",
    exportType: "CASE_REASONING_EXPORT",
    exportedAt: new Date().toISOString(),
    importable: false,
    includesBinaryData: false,
    data: {
      case: {
        id: c.id,
        name: c.name,
        category: c.category,
        status: c.status,
        lastUpdated: c.updatedAt || c.createdAt,
      },
      summary: {
        oneParagraph: (c.description || c.notes || "Active case file management.").substring(0, 500),
        currentPosition: [
          `Case involves ${(c.incidents || []).length} documented incidents.`,
          `Current collection includes ${(c.evidence || []).length} evidence items.`,
          `${openTasks.length} tasks currently pending action.`,
        ],
      },
      caseState,
      riskSummary,
      leveragePoints,
      actionSummary: c.actionSummary || {
        currentFocus: "",
        nextActions: [],
        importantReminders: [],
        strategyFocus: [],
        updatedAt: "",
      },
      keyFacts: (c.strategy || []).length > 0
        ? c.strategy.slice(0, limits.facts).map(s => s.title).filter(Boolean)
        : (c.incidents || []).slice(0, limits.facts).map(i => i.title).filter(Boolean),
      activeIssues,
      recentTimeline,
      milestoneTimeline,
      incidentSummary,
      openTasks,
      strategy: {
        current: strategyCurrent,
        nextMoves: openTasks.map(t => t.title).filter(Boolean).slice(0, 3),
      },
      evidenceSummary,
      documentSummary,
      ledgerSummary,
      chronology,
      reasoningV2: {
        readiness,
        blockers,
        evidencePosture,
      },
      importantPeople: [],
      openQuestions: [],
    },
  };
}
