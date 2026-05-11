const STATUS_RANK = {
  ok: 0,
  warning: 1,
  critical: 2,
};

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function parseTimestamp(value) {
  if (!value || typeof value !== "string") {
    return { ok: false, value: "", time: null };
  }
  const time = Date.parse(value);
  if (Number.isNaN(time)) {
    return { ok: false, value, time: null };
  }
  return { ok: true, value, time };
}

function addIssue(issues, issue) {
  issues.push(issue);
}

function getWorstStatus(issues) {
  return issues.reduce((status, issue) => (
    STATUS_RANK[issue.severity] > STATUS_RANK[status] ? issue.severity : status
  ), "ok");
}

function getReasoningExportMetadata(caseData = {}, options = {}) {
  return (
    options.reasoningExportMetadata ||
    options.exportMetadata ||
    caseData.reasoningExportMetadata ||
    caseData.lastReasoningExportMetadata ||
    caseData.operationalIntegrity?.reasoningExport ||
    caseData.diagnostics?.reasoningExport ||
    null
  );
}

function getNewestRecordUpdate(caseData = {}) {
  const candidates = [
    ...safeArray(caseData.incidents).map((record) => ({ recordType: "incidents", record })),
    ...safeArray(caseData.evidence).map((record) => ({ recordType: "evidence", record })),
    ...safeArray(caseData.documents).map((record) => ({ recordType: "documents", record })),
    ...safeArray(caseData.strategy).map((record) => ({ recordType: "strategy", record })),
  ];

  return candidates.reduce((newest, item) => {
    const timestamp = item.record?.updatedAt || item.record?.createdAt || "";
    const parsed = parseTimestamp(timestamp);
    if (!parsed.ok) return newest;
    if (!newest || parsed.time > newest.time) {
      return {
        time: parsed.time,
        timestamp: parsed.value,
        recordType: item.recordType,
        recordId: item.record?.id || "",
        title: item.record?.title || item.record?.label || "",
      };
    }
    return newest;
  }, null);
}

function differenceInDays(nowTime, thenTime) {
  return Math.floor((nowTime - thenTime) / (24 * 60 * 60 * 1000));
}

function isOpenStatus(value) {
  const status = String(value || "").trim().toLowerCase();
  if (!status) return true;
  return ![
    "closed",
    "complete",
    "completed",
    "done",
    "resolved",
    "archived",
    "cancelled",
    "canceled",
  ].includes(status);
}

function hasItems(value) {
  if (Array.isArray(value)) return value.some((item) => String(item || "").trim());
  return Boolean(String(value || "").trim());
}

function recordTimestamp(record = {}) {
  return record.updatedAt || record.createdAt || record.eventDate || record.date || record.documentDate || record.capturedAt || "";
}

function hasLinkedDocuments(caseData = {}, recordId = "") {
  if (!recordId) return false;
  return safeArray(caseData.documents).some((document) => {
    const linkedRecordIds = safeArray(document.linkedRecordIds);
    const basedOnEvidenceIds = safeArray(document.basedOnEvidenceIds);
    return linkedRecordIds.includes(recordId) || basedOnEvidenceIds.includes(recordId);
  });
}

function hasStrategyLinks(strategy = {}) {
  return (
    safeArray(strategy.linkedRecordIds).length > 0 ||
    safeArray(strategy.linkedIncidentIds).length > 0 ||
    safeArray(strategy.linkedEvidenceIds).length > 0
  );
}

function collectSequenceGroups(caseData = {}) {
  const groups = new Map();
  const sections = [
    ["incidents", safeArray(caseData.incidents)],
    ["evidence", safeArray(caseData.evidence)],
    ["documents", safeArray(caseData.documents)],
    ["strategy", safeArray(caseData.strategy)],
  ];

  for (const [recordType, records] of sections) {
    for (const record of records) {
      const sequenceGroup = String(record?.sequenceGroup || "").trim();
      if (!sequenceGroup) continue;
      const current = groups.get(sequenceGroup) || {
        sequenceGroup,
        records: [],
        openRecords: [],
        newestTime: null,
        newestTimestamp: "",
      };
      const timestamp = recordTimestamp(record);
      const parsed = parseTimestamp(timestamp);
      current.records.push({ recordType, record });
      if (isOpenStatus(record?.status)) {
        current.openRecords.push({ recordType, record });
      }
      if (parsed.ok && (!current.newestTime || parsed.time > current.newestTime)) {
        current.newestTime = parsed.time;
        current.newestTimestamp = parsed.value;
      }
      groups.set(sequenceGroup, current);
    }
  }

  return [...groups.values()];
}

function buildExportFreshness(caseData = {}, options = {}) {
  const issues = [];
  const metadata = getReasoningExportMetadata(caseData, options);
  const nowParsed = parseTimestamp(options.now || new Date().toISOString());
  const nowTime = nowParsed.ok ? nowParsed.time : Date.now();
  const caseUpdatedAt = metadata?.caseUpdatedAt || caseData.updatedAt || caseData.createdAt || "";
  const parsedCaseUpdatedAt = parseTimestamp(caseUpdatedAt);
  const newestRecordUpdate = getNewestRecordUpdate(caseData);

  if (!metadata || typeof metadata !== "object") {
    addIssue(issues, {
      code: "MISSING_EXPORT_METADATA",
      severity: "warning",
      message: "No reasoning export metadata is available for this case.",
      details: {},
    });
  }

  const generatedAt = metadata?.generatedAt || metadata?.exportedAt || "";
  const parsedGeneratedAt = parseTimestamp(generatedAt);

  if (metadata && !generatedAt) {
    addIssue(issues, {
      code: "MISSING_EXPORT_GENERATED_AT",
      severity: "warning",
      message: "Reasoning export metadata is missing generatedAt.",
      details: {
        exportVersion: metadata.exportVersion || "",
      },
    });
  } else if (metadata && !parsedGeneratedAt.ok) {
    addIssue(issues, {
      code: "INVALID_EXPORT_TIMESTAMP",
      severity: "critical",
      message: "Reasoning export generatedAt could not be parsed.",
      details: {
        generatedAt,
      },
    });
  }

  if (parsedGeneratedAt.ok && parsedGeneratedAt.time > nowTime) {
    addIssue(issues, {
      code: "FUTURE_EXPORT_TIMESTAMP",
      severity: "critical",
      message: "Reasoning export generatedAt is in the future.",
      details: {
        generatedAt,
        now: options.now || new Date(nowTime).toISOString(),
      },
    });
  }

  if (parsedGeneratedAt.ok && parsedCaseUpdatedAt.ok && parsedGeneratedAt.time < parsedCaseUpdatedAt.time) {
    addIssue(issues, {
      code: "STALE_EXPORT",
      severity: "warning",
      message: "Reasoning export is older than the current case update timestamp.",
      details: {
        generatedAt,
        caseUpdatedAt,
      },
    });
  } else if (caseUpdatedAt && !parsedCaseUpdatedAt.ok) {
    addIssue(issues, {
      code: "INVALID_CASE_UPDATED_AT",
      severity: "warning",
      message: "Case updatedAt could not be parsed for export freshness comparison.",
      details: {
        caseUpdatedAt,
      },
    });
  }

  if (parsedGeneratedAt.ok && newestRecordUpdate && parsedGeneratedAt.time < newestRecordUpdate.time) {
    addIssue(issues, {
      code: "STALE_EXPORT_RECORD_UPDATE",
      severity: "warning",
      message: "Reasoning export is older than the newest incident, evidence, document, or strategy update.",
      details: {
        generatedAt,
        newestRecordUpdatedAt: newestRecordUpdate.timestamp,
        recordType: newestRecordUpdate.recordType,
        recordId: newestRecordUpdate.recordId,
        title: newestRecordUpdate.title,
      },
    });
  }

  return {
    status: getWorstStatus(issues),
    issues,
    stats: {
      hasMetadata: Boolean(metadata && typeof metadata === "object"),
      generatedAt: generatedAt || "",
      caseUpdatedAt: caseUpdatedAt || "",
      exportVersion: metadata?.exportVersion || "",
      newestRecordUpdatedAt: newestRecordUpdate?.timestamp || "",
      newestRecordType: newestRecordUpdate?.recordType || "",
      newestRecordId: newestRecordUpdate?.recordId || "",
      checkedAt: options.now || new Date(nowTime).toISOString(),
    },
  };
}

function buildOpenOperationalLoops(caseData = {}, options = {}) {
  const issues = [];
  const nowParsed = parseTimestamp(options.now || new Date().toISOString());
  const nowTime = nowParsed.ok ? nowParsed.time : Date.now();
  const strategyStaleDays = Number.isFinite(options.strategyStaleDays) ? options.strategyStaleDays : 14;
  const dormantThreadDays = Number.isFinite(options.dormantThreadDays) ? options.dormantThreadDays : 30;
  const actionSummaryStaleDays = Number.isFinite(options.actionSummaryStaleDays) ? options.actionSummaryStaleDays : 14;

  const staleStrategyItems = safeArray(caseData.strategy).filter((strategy) => {
    if (!isOpenStatus(strategy?.status)) return false;
    if (hasStrategyLinks(strategy)) return false;
    const parsed = parseTimestamp(recordTimestamp(strategy));
    if (!parsed.ok) return false;
    return differenceInDays(nowTime, parsed.time) > strategyStaleDays;
  });

  for (const strategy of staleStrategyItems) {
    const parsed = parseTimestamp(recordTimestamp(strategy));
    const daysStale = parsed.ok ? differenceInDays(nowTime, parsed.time) : null;
    addIssue(issues, {
      code: "STALE_STRATEGY_ITEM",
      severity: "warning",
      message: `Open strategy item "${strategy.title || strategy.id || "Untitled"}" is stale and has no supporting links.`,
      details: {
        strategyId: strategy.id || "",
        title: strategy.title || "",
        daysStale,
      },
    });
  }

  const weakIncidents = safeArray(caseData.incidents).filter((incident) => {
    if (safeArray(incident?.linkedEvidenceIds).length > 0) return false;
    if (safeArray(incident?.attachments).length > 0) return false;
    if (hasLinkedDocuments(caseData, incident?.id)) return false;
    return true;
  });

  for (const incident of weakIncidents) {
    addIssue(issues, {
      code: "WEAK_INCIDENT_EVIDENCE",
      severity: "warning",
      message: `Incident "${incident.title || incident.id || "Untitled"}" has no linked evidence, attachments, or linked documents.`,
      details: {
        incidentId: incident.id || "",
        title: incident.title || "",
      },
    });
  }

  const dormantThreads = collectSequenceGroups(caseData).filter((group) => {
    if (group.openRecords.length === 0) return false;
    if (!group.newestTime) return false;
    return differenceInDays(nowTime, group.newestTime) > dormantThreadDays;
  });

  for (const group of dormantThreads) {
    addIssue(issues, {
      code: "DORMANT_OPERATIONAL_THREAD",
      severity: "warning",
      message: `Sequence group "${group.sequenceGroup}" has open records but no recent activity.`,
      details: {
        sequenceGroup: group.sequenceGroup,
        daysInactive: differenceInDays(nowTime, group.newestTime),
      },
    });
  }

  const actionSummary = caseData.actionSummary || {};
  const hasActionSummaryContent =
    hasItems(actionSummary.currentFocus) ||
    hasItems(actionSummary.nextActions) ||
    hasItems(actionSummary.importantReminders) ||
    hasItems(actionSummary.strategyFocus) ||
    hasItems(actionSummary.criticalDeadlines);
  const actionSummaryTimestamp = actionSummary.updatedAt || "";
  const parsedActionSummaryTimestamp = parseTimestamp(actionSummaryTimestamp);

  if (hasActionSummaryContent && parsedActionSummaryTimestamp.ok) {
    const daysStale = differenceInDays(nowTime, parsedActionSummaryTimestamp.time);
    if (daysStale > actionSummaryStaleDays) {
      addIssue(issues, {
        code: "STALE_ACTION_SUMMARY",
        severity: "warning",
        message: "Action summary still contains active operational priorities but has not been updated recently.",
        details: {
          daysStale,
        },
      });
    }
  } else if (hasActionSummaryContent && !actionSummaryTimestamp) {
    addIssue(issues, {
      code: "STALE_ACTION_SUMMARY",
      severity: "warning",
      message: "Action summary contains active operational priorities but has no updatedAt timestamp.",
      details: {
        daysStale: null,
      },
    });
  }

  return {
    status: getWorstStatus(issues),
    issues,
    stats: {
      staleStrategyItemCount: staleStrategyItems.length,
      weakIncidentCount: weakIncidents.length,
      dormantThreadCount: dormantThreads.length,
      hasActionSummaryContent,
      strategyStaleDays,
      dormantThreadDays,
      actionSummaryStaleDays,
      checkedAt: options.now || new Date(nowTime).toISOString(),
    },
  };
}

export function runOperationalIntegrityCheck(caseData = {}, options = {}) {
  return {
    exportFreshness: buildExportFreshness(caseData, options),
    openOperationalLoops: buildOpenOperationalLoops(caseData, options),
  };
}
