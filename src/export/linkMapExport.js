import { resolveRecordById } from "../domain/linkingResolvers.js";
import { sanitizeCaseForExport } from "./caseExport.js";

const SNIPPET_LIMIT = 300;
const ANALYSIS_NODE_TYPES = new Set(["incident", "evidence", "strategy", "document", "tracking_record", "ledger"]);

function safeText(value) {
  return typeof value === "string" ? value : "";
}

function compactText(value) {
  return safeText(value).replace(/\s+/g, " ").trim();
}

function truncate(value, limit = SNIPPET_LIMIT) {
  const text = compactText(value);
  if (text.length <= limit) return text;
  return `${text.slice(0, limit - 3).trim()}...`;
}

function isTrackingRecordDocument(doc) {
  return typeof doc?.textContent === "string" && doc.textContent.includes("[TRACK RECORD]");
}

function getDate(item = {}) {
  return item.eventDate || item.date || item.documentDate || item.dueDate || item.paymentDate || item.period || item.createdAt || "";
}

function getTitle(item = {}, type = "") {
  if (type === "ledger") return item.label || item.title || "Untitled ledger entry";
  return item.title || item.label || `Untitled ${type || "item"}`;
}

function getNodeType(type, item) {
  if (type === "documents") return isTrackingRecordDocument(item) ? "tracking_record" : "document";
  if (type === "incidents") return "incident";
  if (type === "evidence") return "evidence";
  if (type === "strategy") return "strategy";
  if (type === "ledger") return "ledger";
  if (type === "tasks") return "task";
  return type || "record";
}

function getNodeLabel(nodeType) {
  const labels = {
    incident: "Incident",
    evidence: "Evidence",
    strategy: "Strategy",
    document: "Document",
    tracking_record: "Tracking Record",
    ledger: "Ledger",
    task: "Task",
  };
  return labels[nodeType] || "Record";
}

function getSnippet(item = {}, nodeType = "") {
  if (nodeType === "evidence") {
    return truncate(item.functionSummary || item.description || item.notes || item.reviewNotes);
  }
  if (nodeType === "document" || nodeType === "tracking_record") {
    return truncate(item.summary || item.textContent || item.source || item.notes);
  }
  if (nodeType === "ledger") {
    return truncate(item.notes || item.counterparty || item.category || item.period);
  }
  return truncate(item.description || item.summary || item.notes);
}

function getSourceFields(item = {}) {
  const fields = {};
  ["linkedRecordIds", "linkedEvidenceIds", "linkedIncidentIds"].forEach((field) => {
    if (Array.isArray(item[field]) && item[field].length > 0) {
      fields[field] = [...item[field]];
    }
  });
  if (isTrackingRecordDocument(item) && Array.isArray(item.basedOnEvidenceIds) && item.basedOnEvidenceIds.length > 0) {
    fields.basedOnEvidenceIds = [...item.basedOnEvidenceIds];
  }
  if (Array.isArray(item.linkedIncidentRefs) && item.linkedIncidentRefs.length > 0) {
    fields.linkedIncidentRefs = item.linkedIncidentRefs
      .filter((ref) => ref?.incidentId)
      .map((ref) => ({ incidentId: ref.incidentId, type: ref.type || "" }));
  }
  return fields;
}

function buildNode(item, collectionType) {
  const type = getNodeType(collectionType, item);
  return {
    id: item.id,
    type,
    label: getNodeLabel(type),
    title: getTitle(item, type),
    date: getDate(item),
    status: item.status || item.proofStatus || "",
    snippet: getSnippet(item, type),
    sourceFields: getSourceFields(item),
  };
}

function buildSourceSummary(source) {
  return {
    id: source.id,
    type: source.type,
    title: source.title,
    date: source.date,
    status: source.status,
    snippet: source.snippet,
  };
}

function getResolvedTargetType(resolved) {
  if (!resolved) return "unknown";
  if (resolved.recordType === "document" && isTrackingRecordDocument(resolved.record)) return "tracking_record";
  return resolved.recordType || "record";
}

function buildEdgeId(sourceId, field, targetId, index) {
  return `${sourceId}:${field}:${targetId}:${index}`;
}

function buildEdge(caseItem, sourceNode, field, targetId, relationship, index, linkMeta = {}) {
  const resolved = resolveRecordById(caseItem, targetId);
  const status = resolved ? "resolved" : "missing";
  return {
    id: buildEdgeId(sourceNode.id, field, targetId, index),
    sourceId: sourceNode.id,
    sourceType: sourceNode.type,
    sourceTitle: sourceNode.title,
    targetId,
    targetType: resolved ? getResolvedTargetType(resolved) : "unknown",
    targetLabel: resolved ? resolved.typeLabel || getNodeLabel(getResolvedTargetType(resolved)) : "",
    targetTitle: resolved ? resolved.title || "" : "",
    field,
    relationship,
    status,
    ...(Object.keys(linkMeta).length > 0 ? { linkMeta } : {}),
  };
}

function pushIdEdges(caseItem, edges, missingLinks, sourceNode, ids, field, relationship) {
  if (!Array.isArray(ids)) return;
  ids.filter(Boolean).forEach((targetId, index) => {
    const edge = buildEdge(caseItem, sourceNode, field, targetId, relationship, index);
    edges.push(edge);
    if (edge.status === "missing") {
      missingLinks.push({
        edgeId: edge.id,
        source: buildSourceSummary(sourceNode),
        sourceId: sourceNode.id,
        sourceType: sourceNode.type,
        sourceTitle: sourceNode.title,
        field,
        targetId,
        relationship,
        status: "missing",
      });
    }
  });
}

function pushIncidentRefEdges(caseItem, edges, missingLinks, sourceNode, refs) {
  if (!Array.isArray(refs)) return;
  refs.filter((ref) => ref?.incidentId).forEach((ref, index) => {
    const relationship = ref.type || "INCIDENT_REF";
    const edge = buildEdge(
      caseItem,
      sourceNode,
      "linkedIncidentRefs",
      ref.incidentId,
      relationship,
      index,
      { incidentLinkType: relationship }
    );
    edges.push(edge);
    if (edge.status === "missing") {
      missingLinks.push({
        edgeId: edge.id,
        source: buildSourceSummary(sourceNode),
        sourceId: sourceNode.id,
        sourceType: sourceNode.type,
        sourceTitle: sourceNode.title,
        field: "linkedIncidentRefs",
        targetId: ref.incidentId,
        relationship,
        status: "missing",
      });
    }
  });
}

function collectNodes(caseItem) {
  const sources = [
    ["incidents", caseItem.incidents || []],
    ["evidence", caseItem.evidence || []],
    ["strategy", caseItem.strategy || []],
    ["documents", caseItem.documents || []],
    ["ledger", caseItem.ledger || []],
  ];

  if (Array.isArray(caseItem.tasks) && caseItem.tasks.length > 0) {
    sources.push(["tasks", caseItem.tasks]);
  }

  return sources.flatMap(([type, items]) => items.filter((item) => item?.id).map((item) => buildNode(item, type)));
}

function buildNodeIndex(nodes) {
  return new Map(nodes.map((node) => [node.id, node]));
}

function collectEdges(caseItem, nodes) {
  const nodeIndex = buildNodeIndex(nodes);
  const edges = [];
  const missingLinks = [];

  const addGenericEdges = (items = []) => {
    items.forEach((item) => {
      const sourceNode = nodeIndex.get(item.id);
      if (!sourceNode) return;
      pushIdEdges(caseItem, edges, missingLinks, sourceNode, item.linkedRecordIds, "linkedRecordIds", "linked_record");
    });
  };
  const addTrackingRecordProvenanceEdges = (items = []) => {
    items.forEach((item) => {
      if (!isTrackingRecordDocument(item)) return;
      const sourceNode = nodeIndex.get(item.id);
      if (!sourceNode) return;
      pushIdEdges(caseItem, edges, missingLinks, sourceNode, item.basedOnEvidenceIds, "basedOnEvidenceIds", "provenance");
    });
  };

  (caseItem.incidents || []).forEach((incident) => {
    const sourceNode = nodeIndex.get(incident.id);
    if (!sourceNode) return;
    pushIdEdges(caseItem, edges, missingLinks, sourceNode, incident.linkedEvidenceIds, "linkedEvidenceIds", "has_evidence");
    pushIdEdges(caseItem, edges, missingLinks, sourceNode, incident.linkedIncidentIds, "linkedIncidentIds", "linked_incident");
    pushIncidentRefEdges(caseItem, edges, missingLinks, sourceNode, incident.linkedIncidentRefs);
  });

  (caseItem.evidence || []).forEach((evidence) => {
    const sourceNode = nodeIndex.get(evidence.id);
    if (!sourceNode) return;
    pushIdEdges(caseItem, edges, missingLinks, sourceNode, evidence.linkedIncidentIds, "linkedIncidentIds", "supports_incident");
    pushIdEdges(caseItem, edges, missingLinks, sourceNode, evidence.linkedEvidenceIds, "linkedEvidenceIds", "linked_evidence");
  });

  addGenericEdges(caseItem.incidents || []);
  addGenericEdges(caseItem.evidence || []);
  addGenericEdges(caseItem.strategy || []);
  addGenericEdges(caseItem.documents || []);
  addGenericEdges(caseItem.ledger || []);
  if (Array.isArray(caseItem.tasks) && caseItem.tasks.length > 0) addGenericEdges(caseItem.tasks);
  addTrackingRecordProvenanceEdges(caseItem.documents || []);

  return { edges, missingLinks };
}

function countByType(nodes) {
  return nodes.reduce((counts, node) => {
    counts[node.type] = (counts[node.type] || 0) + 1;
    return counts;
  }, {});
}

function analysisNode(node, reason) {
  return {
    id: node.id,
    type: node.type,
    title: node.title,
    reason,
  };
}

function buildLinkAnalysis(nodes, edges, missingLinks) {
  const incomingCounts = new Map();
  const outgoingCounts = new Map();
  const resolvedEdges = edges.filter((edge) => edge.status === "resolved");
  const analysisNodes = nodes.filter((node) => ANALYSIS_NODE_TYPES.has(node.type));

  edges.forEach((edge) => {
    outgoingCounts.set(edge.sourceId, (outgoingCounts.get(edge.sourceId) || 0) + 1);
    incomingCounts.set(edge.targetId, (incomingCounts.get(edge.targetId) || 0) + 1);
  });

  const hasResolvedEvidenceLink = (node) => resolvedEdges.some((edge) =>
    (edge.sourceId === node.id && edge.field === "linkedEvidenceIds") ||
    (edge.targetId === node.id && edge.sourceType === "evidence" && edge.field === "linkedIncidentIds")
  );

  const hasResolvedIncidentLink = (node) => resolvedEdges.some((edge) =>
    (edge.sourceId === node.id && edge.field === "linkedIncidentIds") ||
    (edge.targetId === node.id && edge.sourceType === "incident" && edge.field === "linkedEvidenceIds")
  );

  const orphanNodes = analysisNodes
    .filter((node) => !incomingCounts.get(node.id) && !outgoingCounts.get(node.id))
    .map((node) => analysisNode(node, "No incoming or outgoing links"));

  const weaklyLinkedNodes = analysisNodes.flatMap((node) => {
    if (node.type === "incident" && !hasResolvedEvidenceLink(node)) {
      return [analysisNode(node, "Incident has no linked evidence")];
    }
    if (node.type === "evidence" && !hasResolvedIncidentLink(node)) {
      return [analysisNode(node, "Evidence has no linked incident")];
    }
    if (
      ["document", "tracking_record", "ledger"].includes(node.type) &&
      !Array.isArray(node.sourceFields.linkedRecordIds)
    ) {
      return [analysisNode(node, `${node.label} has no linked records`)];
    }
    return [];
  });

  return {
    orphanNodes,
    weaklyLinkedNodes,
    integrityFlags: {
      allIncidentsHaveEvidence: !weaklyLinkedNodes.some((node) => node.type === "incident"),
      allEvidenceLinkedToIncidents: !weaklyLinkedNodes.some((node) => node.type === "evidence"),
      missingLinksPresent: missingLinks.length > 0,
      orphanNodesPresent: orphanNodes.length > 0,
    },
  };
}

export function buildCaseLinkMapExportPayload(caseItem) {
  if (!caseItem) {
    throw new Error("caseItem is required for CASE_LINK_MAP_EXPORT");
  }

  const c = sanitizeCaseForExport(caseItem);
  const nodes = collectNodes(c);
  const { edges, missingLinks } = collectEdges(c, nodes);
  const analysis = buildLinkAnalysis(nodes, edges, missingLinks);

  return {
    exportType: "CASE_LINK_MAP_EXPORT",
    schemaVersion: "link-map-1.0",
    exportedAt: new Date().toISOString(),
    case: {
      id: c.id || "",
      name: c.name || "",
      category: c.category || "",
      status: c.status || "",
    },
    summary: {
      nodeCount: nodes.length,
      edgeCount: edges.length,
      missingEdgeCount: missingLinks.length,
      nodeCountsByType: countByType(nodes),
    },
    nodes,
    edges,
    missingLinks,
    analysis,
  };
}
