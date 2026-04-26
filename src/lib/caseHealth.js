import { resolveRecordById } from "../domain/linkingResolvers.js";

export const isTimelineCapable = (type) =>
  ["evidence", "incidents", "strategy"].includes(type?.toLowerCase());

export const getCaseHealthReport = (selectedCase) => {
  const issues = [];
  const incidents = selectedCase.incidents || [];
  const evidence = selectedCase.evidence || [];
  const tasks = selectedCase.tasks || [];
  const strategy = selectedCase.strategy || [];
  const documents = selectedCase.documents || [];
  const ledger = selectedCase.ledger || [];
  const incidentIds = new Set(incidents.map((i) => i.id));

  const collectMissingLinks = (item) => {
    const missing = [];
    const checkIds = (field, ids) => {
      if (!Array.isArray(ids)) return;
      ids.forEach((id) => {
        if (!resolveRecordById(selectedCase, id)) {
          missing.push({ field, id });
        }
      });
    };

    checkIds("linkedRecordIds", item?.linkedRecordIds);
    checkIds("linkedEvidenceIds", item?.linkedEvidenceIds);
    checkIds("linkedIncidentIds", item?.linkedIncidentIds);

    if (Array.isArray(item?.linkedIncidentRefs)) {
      item.linkedIncidentRefs.forEach((ref) => {
        if (ref?.incidentId && !resolveRecordById(selectedCase, ref.incidentId)) {
          missing.push({ field: "linkedIncidentRefs", id: ref.incidentId });
        }
      });
    }

    return missing;
  };

  const makeMissingLinkIssue = (item, type, tab) => {
    const missingLinks = collectMissingLinks(item);
    if (missingLinks.length === 0) return null;

    return makeGap({
      id: item.id,
      title: "Missing linked records",
      detail: `${missingLinks.length} missing linked record${missingLinks.length === 1 ? "" : "s"}`,
      date: item.eventDate || item.date || item.documentDate || item.dueDate || item.paymentDate || item.createdAt,
      record: item,
      type,
      tab,
      missingLinkCount: missingLinks.length,
      missingLinks,
    });
  };

  const taskMap = new Map(tasks.map((t) => [t.id, t]));
  const isResolved = (item) => {
    const linkedTasks = (item.linkedRecordIds || [])
      .map((id) => taskMap.get(id))
      .filter((t) => t && t.type === "tasks");
    return linkedTasks.length > 0 && linkedTasks.every((t) => t.status === "done");
  };

  const isEvidenceResolved = (item) =>
    (item.attachments && item.attachments.length > 0) || isResolved(item);

  const activeIncidents = incidents.filter((i) => !isResolved(i));
  const activeEvidence = evidence.filter((e) => !isEvidenceResolved(e));
  const openTasks = tasks.filter((t) => t.status !== "done");

  const makeGap = (issue) => ({
    ...issue,
    severity: "advisory",
    classification: "gap",
  });

  const incidentIssues = [];
  const incidentTitles = {};

  activeIncidents.forEach((item) => {
    const blockingMissing = [];
    const gapMissing = [];
    if (!(item.eventDate || item.date)) blockingMissing.push("date");
    if (!item.title?.trim()) blockingMissing.push("title");
    if (!item.description?.trim()) blockingMissing.push("description");

    const hasAtt = (item.attachments || []).length > 0;
    const hasEv = (item.linkedEvidenceIds || []).length > 0;
    if (!hasAtt && !hasEv) gapMissing.push("attachment or linked evidence");

    if (blockingMissing.length) {
      incidentIssues.push({
        id: item.id,
        title: item.title || "Untitled Incident",
        detail: `Missing: ${blockingMissing.join(", ")}`,
        date: item.eventDate || item.date,
        record: item,
        type: "incidents",
        tab: "incidents",
        severity: "blocking",
      });
    }

    if (gapMissing.length) {
      incidentIssues.push(makeGap({
        id: item.id,
        title: item.title || "Untitled Incident",
        detail: `Gap: missing ${gapMissing.join(", ")}`,
        date: item.eventDate || item.date,
        record: item,
        type: "incidents",
        tab: "incidents",
      }));
    }

    const norm = (item.title || "").trim().toLowerCase();
    if (norm) {
      if (!incidentTitles[norm]) incidentTitles[norm] = [];
      incidentTitles[norm].push(item);
    }
  });

  Object.entries(incidentTitles).forEach(([title, items]) => {
    if (items.length > 1) {
      items.forEach((item) => {
        incidentIssues.push({
          id: item.id,
          title: item.title || "Untitled Incident",
          detail: `Duplicate incident title: "${title}"`,
          date: item.eventDate || item.date,
          record: item,
          type: "incidents",
          tab: "incidents",
          severity: "advisory",
        });
      });
    }
  });

  if (incidentIssues.length) issues.push({ category: "Incidents", items: incidentIssues });

  const evidenceIssues = [];
  const evidenceTitles = {};

  activeEvidence.forEach((item) => {
    const blockingMissing = [];
    const gapMissing = [];
    if (!item.title?.trim()) blockingMissing.push("title");

    const links = Array.isArray(item.linkedIncidentIds) ? item.linkedIncidentIds : [];
    if (links.length === 0) gapMissing.push("linked incident");

    const broken = links.filter((id) => !incidentIds.has(id));

    const hasPhys = !!item.availability?.physical?.hasOriginal;
    const hasDigi =
      !!item.availability?.digital?.hasDigital || (item.attachments?.length > 0);

    if (!hasPhys && !hasDigi) {
      gapMissing.push("no physical or digital availability set");
    }

    if (blockingMissing.length) {
      evidenceIssues.push({
        id: item.id,
        title: item.title || "Untitled Evidence",
        detail: `Missing: ${blockingMissing.join(", ")}`,
        date: item.eventDate || item.date,
        record: item,
        type: "evidence",
        tab: "evidence",
        severity: "blocking",
      });
    }

    if (gapMissing.length || broken.length) {
      evidenceIssues.push(makeGap({
        id: item.id,
        title: item.title || "Untitled Evidence",
        detail: [
          gapMissing.length ? `Gap: missing ${gapMissing.join(", ")}` : null,
          broken.length ? `Gap: ${broken.length} broken linked incident reference(s)` : null,
        ]
          .filter(Boolean)
          .join("; "),
        date: item.eventDate || item.date,
        record: item,
        type: "evidence",
        tab: "evidence",
      }));
    }

    if ((hasPhys || hasDigi) && (!hasPhys || !hasDigi)) {
      evidenceIssues.push({
        id: item.id,
        title: item.title || "Untitled Evidence",
        detail: hasPhys ? "only physical availability set" : "only digital availability set",
        record: item,
        type: "evidence",
        tab: "evidence",
        severity: "advisory",
      });
    }

    const norm = (item.title || "").trim().toLowerCase();
    if (norm) {
      if (!evidenceTitles[norm]) evidenceTitles[norm] = [];
      evidenceTitles[norm].push(item);
    }
  });

  Object.entries(evidenceTitles).forEach(([title, items]) => {
    if (items.length > 1) {
      items.forEach((item) => {
        evidenceIssues.push({
          id: item.id,
          title: item.title || "Untitled Evidence",
          detail: `Duplicate evidence title: "${title}"`,
          date: item.eventDate || item.date,
          record: item,
          type: "evidence",
          tab: "evidence",
          severity: "advisory",
        });
      });
    }
  });

  if (evidenceIssues.length) issues.push({ category: "Evidence", items: evidenceIssues });

  const taskIssues = openTasks
    .filter((t) => !t.title?.trim())
    .map((t) => ({
      id: t.id,
      title: "Untitled Task",
      detail: "Missing task title",
      record: t,
      type: "tasks",
      tab: "tasks",
      severity: "blocking",
    }));

  if (taskIssues.length) issues.push({ category: "Tasks", items: taskIssues });

  const strategyIssues = strategy
    .filter((s) => !s.title?.trim())
    .map((s) => ({
      id: s.id,
      title: "Untitled Strategy",
      detail: "Missing strategy title",
      record: s,
      type: "strategy",
      tab: "strategy",
      severity: "blocking",
    }));

  if (strategyIssues.length) issues.push({ category: "Strategy", items: strategyIssues });

  const staleLinkSources = [
    ...incidents.map((item) => ({ item, type: "incidents", tab: "incidents" })),
    ...evidence.map((item) => ({ item, type: "evidence", tab: "evidence" })),
    ...strategy.map((item) => ({ item, type: "strategy", tab: "strategy" })),
    ...tasks.map((item) => ({ item, type: "tasks", tab: "tasks" })),
    ...documents.map((item) => ({ item, type: "documents", tab: "documents" })),
    ...ledger.map((item) => ({ item, type: "ledger", tab: "ledger" })),
  ];
  const staleLinkIssues = staleLinkSources
    .map(({ item, type, tab }) => makeMissingLinkIssue(item, type, tab))
    .filter(Boolean);

  if (staleLinkIssues.length) issues.push({ category: "Links", items: staleLinkIssues });

  const timelineItems = [
    ...activeEvidence.map((item) => ({ ...item, _kind: "Evidence" })),
    ...activeIncidents.map((item) => ({ ...item, _kind: "Incident" })),
    ...openTasks.map((item) => ({ ...item, _kind: "Task" })),
    ...strategy.map((item) => ({ ...item, _kind: "Strategy" })),
  ];

  const timelineIssues = [];

  timelineItems.forEach((item, idx) => {
    const type =
      item._kind === "Incident"
        ? "incidents"
        : item._kind === "Task"
          ? "tasks"
          : item._kind.toLowerCase();

    if (!(item.eventDate || item.date)) {
      timelineIssues.push({
        id: item.id,
        title: item.title || "Untitled",
        detail: "Missing timeline date",
        record: item,
        type,
        tab: "timeline",
        severity: "blocking",
      });
    }

    if (item._kind === "Evidence") {
      const links = Array.isArray(item.linkedIncidentIds) ? item.linkedIncidentIds : [];
      if (links.length === 0) {
        timelineIssues.push(makeGap({
          id: item.id,
          title: item.title || "Untitled",
          detail: "Gap: missing linked incident",
          record: item,
          type,
          tab: "timeline",
        }));
      } else {
        const broken = links.filter((id) => !incidentIds.has(id));
        if (broken.length) {
          timelineIssues.push(makeGap({
            id: item.id,
            title: item.title || "Untitled",
            detail: `Gap: ${broken.length} broken linked incident reference(s)`,
            record: item,
            type,
            tab: "timeline",
          }));
        }
      }
    }

    if (idx > 0) {
      const d1 = timelineItems[idx - 1].eventDate || timelineItems[idx - 1].date || "";
      const d2 = item.eventDate || item.date || "";
      if (d1 && d2 && d2 < d1) {
        timelineIssues.push({
          id: item.id,
          title: "Order Warning",
          detail: `"${item.title}" is dated earlier than previous item in storage array`,
          isGlobal: true,
          record: item,
          type,
          tab: "timeline",
          severity: "advisory",
        });
      }
    }
  });

  if (timelineIssues.length) issues.push({ category: "Timeline", items: timelineIssues });

  const totalIssues = issues.reduce(
    (acc, cat) => acc + cat.items.filter((item) => item.severity !== "advisory").length,
    0
  );
  const meaningfulGapKeys = new Set();
  issues.forEach((cat) => {
    cat.items
      .filter((item) => item.classification === "gap")
      .forEach((item) => {
        meaningfulGapKeys.add(`${item.type || cat.category}:${item.id || item.detail}`);
      });
  });
  const meaningfulGapCount = meaningfulGapKeys.size;
  let status = "Healthy";
  if (totalIssues > 0) status = totalIssues <= 5 ? "Needs review" : "High risk";
  else if (meaningfulGapCount >= 2) status = "Needs review";

  return {
    totals: {
      incidents: activeIncidents.length,
      evidence: activeEvidence.length,
      tasks: openTasks.length,
      strategy: strategy.length,
      timeline: timelineItems.length,
    },
    issues,
    totalIssues,
    status,
  };
};
