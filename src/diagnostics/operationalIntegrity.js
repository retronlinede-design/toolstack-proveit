const STATUS_RANK = {
  ok: 0,
  info: 0,
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

function strictCalendarDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? value : "";
}

function calendarDaysBetween(later, earlier) {
  const a = strictCalendarDate(later);
  const b = strictCalendarDate(earlier);
  if (!a || !b) return null;
  const toTime = (value) => { const [y, m, d] = value.split("-").map(Number); return Date.UTC(y, m - 1, d); };
  return Math.floor((toTime(a) - toTime(b)) / 86400000);
}

function textListHasItems(value) {
  return safeArray(value).some((item) => String(typeof item === "string" ? item : item?.text || "").trim());
}

function buildRecordIndex(caseData = {}) {
  const index = new Map();
  for (const [type, records] of [["incidents", caseData.incidents], ["evidence", caseData.evidence], ["documents", caseData.documents], ["ledger", caseData.ledger], ["strategy", caseData.strategy], ["watchItems", caseData.watchItems]]) {
    for (const record of safeArray(records)) if (record?.id) index.set(record.id, { type, record });
  }
  return index;
}

function issueForRecord(code, severity, message, record, recordType, details = {}, recommendedAction = "Review required.") {
  return { code, severity, title: record?.title || record?.id || (recordType === "watchItems" ? "Untitled monitored concern" : "Untitled strategy"), message, recordType, recordId: record?.id || "", navigationTarget: { tab: recordType === "watchItems" ? "watch" : "strategy", recordId: record?.id || "" }, recommendedAction, details };
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
  const watchStaleDays = Number.isFinite(options.watchStaleDays) ? options.watchStaleDays : 14;
  const today = strictCalendarDate(options.today) || strictCalendarDate((options.now || new Date().toISOString()).slice(0, 10));
  const recordIndex = buildRecordIndex(caseData);
  const partyIds = new Set(safeArray(caseData.parties).map((party) => party?.id).filter(Boolean));
  const metrics = { overdueStrategyReviews: 0, unsupportedStrategies: 0, highPriorityStrategiesWithoutNextSteps: 0, overdueWatchReviews: 0, staleWatchItems: 0, escalatedWatchItemsWithoutOutcome: 0, watchItemsRequiringEscalationReview: 0 };

  for (const strategy of safeArray(caseData.strategy)) {
    if (!isOpenStatus(strategy?.status)) continue;
    const priority = String(strategy?.priority || "").toLowerCase();
    const linkedIds = [...safeArray(strategy.linkedRecordIds), ...safeArray(strategy.linkedIncidentIds), ...safeArray(strategy.linkedEvidenceIds)];
    const validLinks = linkedIds.filter((id) => recordIndex.has(id));
    const groupSupport = String(strategy.sequenceGroup || "").trim() && [...recordIndex.values()].some(({ record }) => record?.id !== strategy.id && String(record?.sequenceGroup || "").trim() === String(strategy.sequenceGroup).trim());
    if (validLinks.length === 0 && !groupSupport) {
      metrics.unsupportedStrategies += 1;
      addIssue(issues, issueForRecord("STRATEGY_UNSUPPORTED", ["high", "critical"].includes(priority) ? "warning" : "info", "Active strategy has no linked supporting records or sequence-group support.", strategy, "strategy", {}, "Link relevant records or confirm the strategy context."));
    }
    const hasNextSteps = textListHasItems(strategy.nextSteps);
    if (["high", "critical"].includes(priority) && !hasNextSteps) {
      metrics.highPriorityStrategiesWithoutNextSteps += 1;
      addIssue(issues, issueForRecord("STRATEGY_NO_NEXT_STEPS", "warning", "High-priority strategy has no recorded next steps.", strategy, "strategy", {}, "Record a concrete next step."));
    }
    const overdueDays = calendarDaysBetween(today, strategy.reviewDate);
    if (overdueDays != null && overdueDays > 0) {
      metrics.overdueStrategyReviews += 1;
      addIssue(issues, issueForRecord("STRATEGY_REVIEW_OVERDUE", ["high", "critical"].includes(priority) ? "warning" : "info", `Strategy review is ${overdueDays} calendar day${overdueDays === 1 ? "" : "s"} overdue.`, strategy, "strategy", { reviewDate: strategy.reviewDate, daysOverdue: overdueDays }, "Review the strategy and update its review date or status."));
    }
    if (textListHasItems(strategy.risks) && !hasNextSteps) addIssue(issues, issueForRecord("STRATEGY_RISK_WITHOUT_ACTION", "warning", "Strategy records risks but no corresponding next steps.", strategy, "strategy", {}, "Add next steps addressing the recorded planning risks."));
    if (![strategy.objective, strategy.description, strategy.title].some((value) => String(value || "").trim())) addIssue(issues, issueForRecord("STRATEGY_MISSING_OBJECTIVE", "warning", "Strategy has no objective, description, or title.", strategy, "strategy", {}, "Record the strategy objective."));
    if (priority === "critical" && !String(strategy.ownerPartyId || "").trim()) addIssue(issues, issueForRecord("STRATEGY_CRITICAL_NO_OWNER", "warning", "Critical strategy has no recorded owner.", strategy, "strategy", {}, "Assign an accountable owner."));
    // Missing owner targets are left to the shared broken-reference diagnostic.
    void partyIds;
  }

  const inactiveWatchStatuses = new Set(["resolved", "archived", "no_longer_relevant"]);
  for (const watch of safeArray(caseData.watchItems)) {
    const status = String(watch?.status || "watching").toLowerCase();
    if (inactiveWatchStatuses.has(status)) continue;
    const priority = String(watch?.priority || "").toLowerCase();
    const observations = safeArray(watch.observations).filter((item) => String(item?.text || "").trim());
    const observationDates = observations.map((item) => strictCalendarDate(item.date)).filter(Boolean).sort();
    const newestObservationDate = observationDates.at(-1) || observations.map((item) => strictCalendarDate(String(item.createdAt || "").slice(0, 10))).filter(Boolean).sort().at(-1) || "";
    const reviewOverdueDays = calendarDaysBetween(today, watch.reviewDate);
    if (["watching", "escalated"].includes(status) && reviewOverdueDays != null && reviewOverdueDays > 0) {
      metrics.overdueWatchReviews += 1;
      addIssue(issues, issueForRecord("WATCH_REVIEW_OVERDUE", "warning", `Monitoring review is ${reviewOverdueDays} calendar day${reviewOverdueDays === 1 ? "" : "s"} overdue.`, watch, "watchItems", { reviewDate: watch.reviewDate, daysOverdue: reviewOverdueDays }, "Review this monitored concern."));
    }
    const timestamp = recordTimestamp(watch);
    const parsedTimestamp = parseTimestamp(timestamp);
    const timestampAge = parsedTimestamp.ok ? differenceInDays(nowTime, parsedTimestamp.time) : null;
    const observationAge = newestObservationDate ? calendarDaysBetween(today, newestObservationDate) : null;
    const monitoringAge = observationAge ?? timestampAge;
    if (status === "watching" && ["high", "critical"].includes(priority) && (monitoringAge == null || monitoringAge > watchStaleDays)) addIssue(issues, issueForRecord("WATCH_NO_RECENT_OBSERVATION", "warning", "High-priority monitoring item has no recent observation recorded.", watch, "watchItems", { daysSinceObservation: monitoringAge, thresholdDays: watchStaleDays }, "Record a current observation or revise the monitoring status."));
    if (status === "watching" && (monitoringAge == null || monitoringAge > watchStaleDays)) {
      metrics.staleWatchItems += 1;
      addIssue(issues, issueForRecord("WATCH_STALE", "warning", "Monitoring item has no recent update or observation.", watch, "watchItems", { daysInactive: monitoringAge, thresholdDays: watchStaleDays }, "Review or update this monitoring item."));
    }
    if (status === "watching" && !String(watch.watchFor || "").trim() && !textListHasItems(watch.triggerConditions)) addIssue(issues, issueForRecord("WATCH_NO_MONITORING_DEFINITION", "warning", "Active monitoring item has no monitoring definition or trigger conditions.", watch, "watchItems", {}, "Define what should be monitored or the trigger for review."));
    const validLinkedOutcomes = safeArray(watch.linkedRecordIds).map((id) => recordIndex.get(id)).filter((target) => ["incidents", "strategy"].includes(target?.type));
    if (status === "escalated" && validLinkedOutcomes.length === 0) {
      metrics.escalatedWatchItemsWithoutOutcome += 1;
      addIssue(issues, issueForRecord("WATCH_ESCALATED_NO_OUTCOME", "warning", "Escalated watch item is not linked to an Incident or Strategy.", watch, "watchItems", {}, "Link the escalation outcome while preserving the monitored concern."));
    }
    if (status === "watching" && textListHasItems(watch.triggerConditions) && (String(watch.latestObservation || "").trim() || observations.length > 0)) {
      metrics.watchItemsRequiringEscalationReview += 1;
      addIssue(issues, issueForRecord("WATCH_TRIGGER_REVIEW_REQUIRED", "warning", "New observations exist against recorded trigger conditions. Review whether escalation is required.", watch, "watchItems", {}, "Review required; do not treat the trigger as satisfied without confirmation."));
    }
    if (status === "watching" && ["high", "critical"].includes(priority) && !String(watch.nextCheck || "").trim() && !strictCalendarDate(watch.reviewDate)) addIssue(issues, issueForRecord("WATCH_NO_NEXT_CHECK", "warning", "High-priority monitoring item has no next check or review date.", watch, "watchItems", {}, "Record a next check or review date."));
    const validContext = safeArray(watch.linkedRecordIds).some((id) => recordIndex.has(id));
    const validParties = safeArray(watch.linkedPartyIds).some((id) => partyIds.has(id));
    if ((status === "escalated" || priority === "critical") && !validContext && !validParties) addIssue(issues, issueForRecord("WATCH_MISSING_LINKED_CONTEXT", "info", "Monitoring item has no linked supporting records or related people.", watch, "watchItems", {}, "Add relevant context if available."));
  }

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
      watchStaleDays,
      ...metrics,
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
