import test from "node:test";
import assert from "node:assert/strict";

import { buildCaseLinkMapExportPayload } from "./linkMapExport.js";

const binaryAttachment = {
  id: "att-1",
  name: "photo.png",
  mimeType: "image/png",
  dataUrl: "data:image/png;base64,abc",
  backupDataUrl: "data:image/png;base64,backup",
  payload: "raw-binary",
  file: { name: "raw-file" },
};

function buildLinkMapCase() {
  return {
    id: "case-1",
    name: "Link Map Case",
    category: "housing",
    status: "open",
    incidents: [
      {
        id: "inc-1",
        title: "Leak reported",
        status: "open",
        eventDate: "2024-01-01",
        description: "Tenant reported the bathroom leak to the landlord.",
        linkedEvidenceIds: ["ev-1", "missing-evidence"],
        linkedIncidentRefs: [{ incidentId: "inc-2", type: "CAUSES" }],
        linkedRecordIds: ["doc-1", "ledger-1"],
      },
      {
        id: "inc-2",
        title: "Repair delayed",
        status: "open",
        eventDate: "2024-01-05",
        description: "Repair did not happen on the promised date.",
      },
    ],
    evidence: [
      {
        id: "ev-1",
        title: "Leak photo",
        status: "verified",
        date: "2024-01-01",
        description: "Photo of water damage near the ceiling.",
        linkedIncidentIds: ["inc-1"],
        linkedRecordIds: ["track-1"],
        attachments: [binaryAttachment],
      },
    ],
    strategy: [
      {
        id: "str-1",
        title: "Request repair record",
        status: "open",
        date: "2024-01-07",
        description: "Ask for written repair history.",
        linkedRecordIds: ["doc-1"],
      },
    ],
    documents: [
      {
        id: "doc-1",
        title: "Landlord email",
        documentDate: "2024-01-02",
        summary: "Email acknowledging the leak.",
        linkedRecordIds: ["inc-1"],
      },
      {
        id: "track-1",
        title: "Repair tracker",
        documentDate: "2024-01-03",
        textContent: "[TRACK RECORD]\nmeta:\ntype: compliance\nsubject: Repair actions\n--- TABLE ---\nDate | Action\n--- SUMMARY (GPT READY) ---\nTracks repair promises and actions.",
        linkedRecordIds: ["ev-1"],
        basedOnEvidenceIds: ["ev-1"],
      },
    ],
    ledger: [
      {
        id: "ledger-1",
        label: "Repair cost",
        status: "unpaid",
        paymentDate: "2024-01-09",
        notes: "Out-of-pocket repair cost.",
        linkedRecordIds: ["missing-ledger-link"],
      },
    ],
    tasks: [
      {
        id: "task-1",
        title: "Follow up",
        status: "todo",
        dueDate: "2024-01-10",
        description: "Ask for repair confirmation.",
        linkedRecordIds: ["inc-1"],
      },
    ],
  };
}

test("buildCaseLinkMapExportPayload creates nodes for major linkable types", () => {
  const payload = buildCaseLinkMapExportPayload(buildLinkMapCase());

  assert.equal(payload.exportType, "CASE_LINK_MAP_EXPORT");
  assert.equal(payload.schemaVersion, "link-map-1.0");
  assert.equal(payload.case.id, "case-1");
  assert.equal(payload.summary.nodeCountsByType.incident, 2);
  assert.equal(payload.summary.nodeCountsByType.evidence, 1);
  assert.equal(payload.summary.nodeCountsByType.strategy, 1);
  assert.equal(payload.summary.nodeCountsByType.document, 1);
  assert.equal(payload.summary.nodeCountsByType.tracking_record, 1);
  assert.equal(payload.summary.nodeCountsByType.ledger, 1);
  assert.equal(payload.summary.nodeCountsByType.task, 1);
});

test("buildCaseLinkMapExportPayload keeps task nodes and edges but excludes task orphans from analysis", () => {
  const caseItem = buildLinkMapCase();
  caseItem.tasks.push({
    id: "task-orphan",
    title: "Legacy orphan task",
    status: "todo",
    description: "Legacy task with no links.",
  });

  const payload = buildCaseLinkMapExportPayload(caseItem);

  assert.ok(payload.nodes.find((node) => node.id === "task-orphan" && node.type === "task"));
  assert.ok(payload.edges.find((edge) =>
    edge.sourceId === "task-1" &&
    edge.targetId === "inc-1" &&
    edge.field === "linkedRecordIds"
  ));
  assert.equal(payload.analysis.orphanNodes.some((node) => node.id === "task-orphan"), false);
  assert.equal(payload.analysis.weaklyLinkedNodes.some((node) => node.id === "task-orphan"), false);
});

test("buildCaseLinkMapExportPayload creates typed incident and evidence edges", () => {
  const payload = buildCaseLinkMapExportPayload(buildLinkMapCase());

  assert.ok(payload.edges.find((edge) =>
    edge.sourceId === "inc-1" &&
    edge.targetId === "ev-1" &&
    edge.field === "linkedEvidenceIds" &&
    edge.relationship === "has_evidence" &&
    edge.status === "resolved"
  ));
  assert.ok(payload.edges.find((edge) =>
    edge.sourceId === "ev-1" &&
    edge.targetId === "inc-1" &&
    edge.field === "linkedIncidentIds" &&
    edge.relationship === "supports_incident" &&
    edge.status === "resolved"
  ));
  assert.ok(payload.edges.find((edge) =>
    edge.sourceId === "inc-1" &&
    edge.targetId === "inc-2" &&
    edge.field === "linkedIncidentRefs" &&
    edge.relationship === "CAUSES" &&
    edge.linkMeta.incidentLinkType === "CAUSES"
  ));
});

test("buildCaseLinkMapExportPayload creates generic linkedRecordIds edges", () => {
  const payload = buildCaseLinkMapExportPayload(buildLinkMapCase());

  assert.ok(payload.edges.find((edge) =>
    edge.sourceId === "inc-1" &&
    edge.targetId === "doc-1" &&
    edge.field === "linkedRecordIds" &&
    edge.targetType === "document"
  ));
  assert.ok(payload.edges.find((edge) =>
    edge.sourceId === "ev-1" &&
    edge.targetId === "track-1" &&
    edge.field === "linkedRecordIds" &&
    edge.targetType === "tracking_record"
  ));
  assert.ok(payload.edges.find((edge) =>
    edge.sourceId === "task-1" &&
    edge.targetId === "inc-1" &&
    edge.field === "linkedRecordIds" &&
    edge.targetType === "incident"
  ));
});

test("buildCaseLinkMapExportPayload creates tracking record provenance edges", () => {
  const payload = buildCaseLinkMapExportPayload(buildLinkMapCase());

  assert.ok(payload.edges.find((edge) =>
    edge.sourceId === "track-1" &&
    edge.sourceType === "tracking_record" &&
    edge.targetId === "ev-1" &&
    edge.targetType === "evidence" &&
    edge.field === "basedOnEvidenceIds" &&
    edge.relationship === "provenance" &&
    edge.status === "resolved"
  ));

  const trackingNode = payload.nodes.find((node) => node.id === "track-1");
  assert.deepEqual(trackingNode.sourceFields.basedOnEvidenceIds, ["ev-1"]);
});

test("buildCaseLinkMapExportPayload preserves missing links as edges and missingLinks entries", () => {
  const payload = buildCaseLinkMapExportPayload(buildLinkMapCase());

  const missingEvidenceEdge = payload.edges.find((edge) => edge.targetId === "missing-evidence");
  const missingLedgerEdge = payload.edges.find((edge) => edge.targetId === "missing-ledger-link");

  assert.equal(missingEvidenceEdge.status, "missing");
  assert.equal(missingEvidenceEdge.targetType, "unknown");
  assert.equal(missingLedgerEdge.status, "missing");
  assert.equal(payload.summary.missingEdgeCount, 2);
  assert.ok(payload.missingLinks.find((link) =>
    link.sourceId === "inc-1" &&
    link.field === "linkedEvidenceIds" &&
    link.targetId === "missing-evidence"
  ));
  assert.ok(payload.missingLinks.find((link) =>
    link.sourceId === "ledger-1" &&
    link.field === "linkedRecordIds" &&
    link.targetId === "missing-ledger-link"
  ));
});

test("buildCaseLinkMapExportPayload classifies tracking record documents", () => {
  const payload = buildCaseLinkMapExportPayload(buildLinkMapCase());
  const trackingNode = payload.nodes.find((node) => node.id === "track-1");

  assert.equal(trackingNode.type, "tracking_record");
  assert.equal(trackingNode.label, "Tracking Record");
  assert.match(trackingNode.snippet, /Tracks repair promises/);
});

test("buildCaseLinkMapExportPayload does not leak binary attachment payloads", () => {
  const payload = buildCaseLinkMapExportPayload(buildLinkMapCase());
  const serialized = JSON.stringify(payload);

  assert.equal(serialized.includes("data:image/png;base64"), false);
  assert.equal(serialized.includes("backupDataUrl"), false);
  assert.equal(serialized.includes("raw-binary"), false);
  assert.equal(serialized.includes("raw-file"), false);
});

test("buildCaseLinkMapExportPayload detects orphan nodes", () => {
  const caseItem = buildLinkMapCase();
  caseItem.strategy.push({
    id: "str-orphan",
    title: "Unused strategy",
    status: "open",
    description: "No links have been added yet.",
  });

  const payload = buildCaseLinkMapExportPayload(caseItem);
  const orphan = payload.analysis.orphanNodes.find((node) => node.id === "str-orphan");

  assert.deepEqual(orphan, {
    id: "str-orphan",
    type: "strategy",
    title: "Unused strategy",
    reason: "No incoming or outgoing links",
  });
  assert.equal(payload.analysis.integrityFlags.orphanNodesPresent, true);
});

test("buildCaseLinkMapExportPayload detects incidents without linked evidence", () => {
  const payload = buildCaseLinkMapExportPayload(buildLinkMapCase());
  const weakIncident = payload.analysis.weaklyLinkedNodes.find((node) => node.id === "inc-2");

  assert.deepEqual(weakIncident, {
    id: "inc-2",
    type: "incident",
    title: "Repair delayed",
    reason: "Incident has no linked evidence",
  });
});

test("buildCaseLinkMapExportPayload detects evidence without linked incidents", () => {
  const caseItem = buildLinkMapCase();
  caseItem.evidence.push({
    id: "ev-unlinked",
    title: "Unlinked receipt",
    status: "unreviewed",
    date: "2024-01-11",
    description: "Receipt not connected to an incident yet.",
  });

  const payload = buildCaseLinkMapExportPayload(caseItem);
  const weakEvidence = payload.analysis.weaklyLinkedNodes.find((node) => node.id === "ev-unlinked");

  assert.deepEqual(weakEvidence, {
    id: "ev-unlinked",
    type: "evidence",
    title: "Unlinked receipt",
    reason: "Evidence has no linked incident",
  });
});

test("buildCaseLinkMapExportPayload reports graph integrity flags", () => {
  const payload = buildCaseLinkMapExportPayload(buildLinkMapCase());

  assert.equal(payload.analysis.integrityFlags.allIncidentsHaveEvidence, false);
  assert.equal(payload.analysis.integrityFlags.allEvidenceLinkedToIncidents, true);
  assert.equal(payload.analysis.integrityFlags.missingLinksPresent, true);
  assert.equal(payload.analysis.integrityFlags.orphanNodesPresent, false);
});
