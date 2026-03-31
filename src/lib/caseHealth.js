export const isTimelineCapable = (type) =>
  ["evidence", "incidents", "strategy"].includes(type?.toLowerCase());

export const getCaseHealthReport = (selectedCase) => {
  const issues = [];
  const incidents = selectedCase.incidents || [];
  const evidence = selectedCase.evidence || [];
  const tasks = selectedCase.tasks || [];
  const strategy = selectedCase.strategy || [];
  const incidentIds = new Set(incidents.map((i) => i.id));

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

  const incidentIssues = [];
  const incidentTitles = {};

  activeIncidents.forEach((item) => {
    const missing = [];
    if (!(item.eventDate || item.date)) missing.push("date");
    if (!item.title?.trim()) missing.push("title");
    if (!item.description?.trim()) missing.push("summary");

    const hasAtt = (item.attachments || []).length > 0;
    const hasEv = (item.linkedEvidenceIds || []).length > 0;
    if (!hasAtt && !hasEv) missing.push("supporting evidence");

    if (missing.length) {
      incidentIssues.push({
        id: item.id,
        title: item.title || "Untitled Incident",
        detail: `Missing: ${missing.join(", ")}`,
        date: item.eventDate || item.date,
        record: item,
        type: "incidents",
        tab: "incidents",
      });
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
          detail: `Duplicate title: "${title}"`,
          date: item.eventDate || item.date,
          record: item,
          type: "incidents",
          tab: "incidents",
        });
      });
    }
  });

  if (incidentIssues.length) issues.push({ category: "Incidents", items: incidentIssues });

  const evidenceIssues = [];
  const evidenceTitles = {};

  activeEvidence.forEach((item) => {
    const missing = [];
    if (!item.title?.trim()) missing.push("title");

    const links = Array.isArray(item.linkedIncidentIds) ? item.linkedIncidentIds : [];
    if (links.length === 0) missing.push("linkedIncidentIds");

    const broken = links.filter((id) => !incidentIds.has(id));

    const hasPhys = !!item.availability?.physical?.hasOriginal;
    const hasDigi =
      !!item.availability?.digital?.hasDigital || (item.attachments?.length > 0);

    if (!hasPhys && !hasDigi) {
      missing.push("availability (no physical OR digital)");
    }

    if (missing.length || broken.length) {
      evidenceIssues.push({
        id: item.id,
        title: item.title || "Untitled Evidence",
        detail: [
          missing.length ? `Missing: ${missing.join(", ")}` : null,
          broken.length ? `${broken.length} broken link(s)` : null,
        ]
          .filter(Boolean)
          .join("; "),
        date: item.eventDate || item.date,
        record: item,
        type: "evidence",
        tab: "evidence",
      });
    }

    if ((hasPhys || hasDigi) && (!hasPhys || !hasDigi)) {
      evidenceIssues.push({
        id: item.id,
        title: item.title || "Untitled Evidence",
        detail: `Partial availability: ${hasPhys ? "Physical only" : "Digital only"}`,
        record: item,
        type: "evidence",
        tab: "evidence",
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
          detail: `Duplicate title: "${title}"`,
          date: item.eventDate || item.date,
          record: item,
          type: "evidence",
          tab: "evidence",
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
      detail: "Missing title",
      record: t,
      type: "tasks",
      tab: "tasks",
    }));

  if (taskIssues.length) issues.push({ category: "Tasks", items: taskIssues });

  const strategyIssues = strategy
    .filter((s) => !s.title?.trim())
    .map((s) => ({
      id: s.id,
      title: "Untitled Strategy",
      detail: "Missing title",
      record: s,
      type: "strategy",
      tab: "strategy",
    }));

  if (strategyIssues.length) issues.push({ category: "Strategy", items: strategyIssues });

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
        detail: "Missing date",
        record: item,
        type,
        tab: "timeline",
      });
    }

    if (item._kind === "Evidence") {
      const links = Array.isArray(item.linkedIncidentIds) ? item.linkedIncidentIds : [];
      if (links.length === 0) {
        timelineIssues.push({
          id: item.id,
          title: item.title || "Untitled",
          detail: "Missing linkedIncidentIds",
          record: item,
          type,
          tab: "timeline",
        });
      } else {
        const broken = links.filter((id) => !incidentIds.has(id));
        if (broken.length) {
          timelineIssues.push({
            id: item.id,
            title: item.title || "Untitled",
            detail: `${broken.length} broken linked incident reference(s)`,
            record: item,
            type,
            tab: "timeline",
          });
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
        });
      }
    }
  });

  if (timelineIssues.length) issues.push({ category: "Timeline", items: timelineIssues });

  const totalIssues = issues.reduce((acc, cat) => acc + cat.items.length, 0);
  let status = "Healthy";
  if (totalIssues > 0) status = totalIssues <= 5 ? "Needs review" : "High risk";

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