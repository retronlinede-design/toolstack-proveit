import { getCaseHealthReport } from "../lib/caseHealth.js";
import { sortTimelineItems } from "../domain/caseDomain.js";

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
  const limits = mode === "compact" ? { timeline: 5, facts: 8, tasks: 8 } : { timeline: 12, facts: 12, tasks: 12 };

  const mapImportance = (val) => {
    const v = String(val || "").toLowerCase();
    if (v === "critical") return "high";
    if (v === "strong") return "medium";
    return "low";
  };

  const openTasks = (c.tasks || [])
    .filter(t => t.status !== "done")
    .slice(0, limits.tasks)
    .map(t => ({
      id: t.id,
      title: t.title,
      status: t.status,
      priority: t.priority || "medium",
      description: t.description || "",
    }));

  const activeIssues = [...(c.incidents || []), ...(c.evidence || [])]
    .filter(i => (i.status !== "verified" && i.status !== "archived") || i.importance === "critical")
    .slice(0, limits.facts)
    .map(i => ({
      id: i.id,
      title: i.title,
      status: i.status,
      importance: mapImportance(i.importance),
      summary: (i.description || i.notes || "").substring(0, 200),
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

  const incidentSummary = sortTimelineItems(c.incidents || [])
    .reverse()
    .slice(0, limits.timeline)
    .map(i => ({
      id: i.id,
      title: i.title,
      status: i.status,
      importance: i.importance,
      date: i.eventDate || i.date || "",
      summary: (i.description || i.notes || "").substring(0, 300),
      linkedEvidenceIds: Array.isArray(i.linkedEvidenceIds) ? i.linkedEvidenceIds : [],
    }));

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
    .map(s => ({
      id: s.id,
      title: s.title,
      status: s.status,
      date: s.eventDate || s.date || "",
      summary: (s.description || s.notes || "").substring(0, 300),
      linkedRecordIds: Array.isArray(s.linkedRecordIds) ? s.linkedRecordIds : [],
    }));
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
  }));
  const documentSummary = (c.documents || []).map(d => ({
    id: d.id,
    title: d.title,
    category: d.category,
    documentDate: d.documentDate,
    source: d.source,
    summary: d.summary || "",
    hasTextContent: !!d.textContent,
    attachmentCount: Array.isArray(d.attachments) ? d.attachments.length : 0,
    linkedRecordIds: Array.isArray(d.linkedRecordIds) ? d.linkedRecordIds : [],
  }));
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
      incidentSummary,
      openTasks,
      strategy: {
        current: strategyCurrent,
        nextMoves: openTasks.map(t => t.title).filter(Boolean).slice(0, 3),
      },
      evidenceSummary,
      documentSummary,
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
