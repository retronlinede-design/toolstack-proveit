import assert from "node:assert/strict";
import test from "node:test";

import {
  REPORT_CHECKSUM_FORMAT,
  REPORT_CLAIM_CLASSIFICATIONS,
  calculateReportRevisionChecksum,
  canApproveReportRevision,
  canTransitionReportLifecycle,
  canonicalSerialiseReportRevisionContent,
  findReportRevisionConflicts,
  getReportSourceFreshness,
  transitionReportLifecycle,
  validateReportCitation,
  validateReportClaim,
  validateReportManifest,
  validateReportRevision,
  verifyReportRevisionChecksum,
} from "./reportLifecycle.js";

function manifest(overrides = {}) {
  return {
    schemaVersion: 1,
    id: "report-1",
    caseId: "case-1",
    reportType: "investigation",
    scope: { type: "issue", issueId: "issue-1", issueReference: "ISS-001", issueName: "Employment" },
    title: "Investigation report",
    createdAt: "2026-10-25T12:00:00.000Z",
    currentRevisionId: "revision-1",
    approvedRevisionId: null,
    revisionIds: ["revision-1"],
    status: "draft",
    ...overrides,
  };
}

function citation(overrides = {}) {
  return {
    id: "citation-1",
    recordType: "evidence",
    recordId: "evidence-1",
    issueId: "issue-1",
    relationship: "direct",
    recordReference: "EVD-001",
    recordTitle: "Email",
    verificationStatus: "verified",
    ...overrides,
  };
}

function revision(overrides = {}) {
  return {
    schemaVersion: 1,
    id: "revision-1",
    reportId: "report-1",
    versionNumber: 1,
    parentRevisionId: null,
    createdAt: "2026-10-25T12:00:00.000Z",
    source: { caseRevision: 7, fingerprint: "fnv1a-12345678" },
    content: { schemaVersion: 1, report: { title: "Investigation" }, sections: [{ id: "summary", items: ["A"] }] },
    generationMode: "deterministic",
    provenance: { citations: [citation()], claims: [{ id: "claim-1", classification: "recorded_fact", citationIds: ["citation-1"] }] },
    contentChecksum: `${REPORT_CHECKSUM_FORMAT}:${"0".repeat(64)}`,
    ...overrides,
  };
}

test("report lifecycle validates manifests and canonical Issue scope", () => {
  assert.deepEqual(validateReportManifest(manifest()), { valid: true, errors: [] });
  const invalid = validateReportManifest(manifest({ scope: { type: "issue", issueId: "" }, currentRevisionId: "missing" }));
  assert.equal(invalid.valid, false);
  assert.ok(invalid.errors.some((error) => error.includes("Issue ID")));
  assert.ok(invalid.errors.some((error) => error.includes("Current revision ID")));
});

test("report revision validates immutable structured content and provenance", () => {
  assert.equal(validateReportRevision(revision()).valid, true);
  const invalid = validateReportRevision(revision({ generationMode: "embedded_ai", contentChecksum: "wrong" }));
  assert.equal(invalid.valid, false);
  assert.ok(invalid.errors.some((error) => error.includes("generation mode")));
  assert.ok(invalid.errors.some((error) => error.includes("Content checksum")));
});

test("canonical serialization is stable for object property order while preserving arrays", () => {
  assert.equal(canonicalSerialiseReportRevisionContent({ b: 1, a: { y: 2, x: ["first", "second"] } }), canonicalSerialiseReportRevisionContent({ a: { x: ["first", "second"], y: 2 }, b: 1 }));
  assert.notEqual(canonicalSerialiseReportRevisionContent({ list: ["first", "second"] }), canonicalSerialiseReportRevisionContent({ list: ["second", "first"] }));
});

test("checksum covers immutable content and ignores lifecycle metadata", async () => {
  const source = revision();
  const checksum = await calculateReportRevisionChecksum(source);
  const withChecksum = { ...source, contentChecksum: checksum };
  assert.equal(await calculateReportRevisionChecksum({ ...withChecksum, lifecycle: { status: "draft" } }), checksum);
  assert.equal(await calculateReportRevisionChecksum({
    ...withChecksum,
    content: { sections: [{ items: ["A"], id: "summary" }], report: { title: "Investigation" }, schemaVersion: 1 },
  }), checksum);
  assert.notEqual(await calculateReportRevisionChecksum({ ...withChecksum, content: { ...withChecksum.content, report: { title: "Changed" } } }), checksum);
  assert.deepEqual(await verifyReportRevisionChecksum(withChecksum), { valid: true, errors: [] });
});

test("canonical serializer rejects binary-like and unsupported values", () => {
  assert.throws(() => canonicalSerialiseReportRevisionContent({ attachment: { dataUrl: "data:image/png;base64,abc" } }), /data URL|forbidden binary/i);
  assert.throws(() => canonicalSerialiseReportRevisionContent({ bytes: [1, 2] }), /forbidden binary/i);
  assert.throws(() => canonicalSerialiseReportRevisionContent({ fn() {} }), /unsupported/i);
});

test("provenance validates citations structurally without treating them as current-record proof", () => {
  assert.equal(validateReportCitation(citation()).valid, true);
  assert.equal(validateReportCitation(citation({ relationship: "unsupported" })).valid, false);
  for (const classification of REPORT_CLAIM_CLASSIFICATIONS) {
    assert.equal(validateReportClaim({ id: classification, classification, citationIds: ["citation-1"] }).valid, true, classification);
  }
  assert.equal(validateReportClaim({ classification: "verified_fact" }).valid, false);
});

test("freshness and approval fail closed for stale or unknown source fingerprints", async () => {
  const source = revision();
  const checksum = await calculateReportRevisionChecksum(source);
  const saved = { ...source, contentChecksum: checksum };
  assert.equal(getReportSourceFreshness(saved, "fnv1a-12345678"), "current");
  assert.equal(getReportSourceFreshness(saved, "fnv1a-different"), "stale");
  assert.equal(getReportSourceFreshness(saved, ""), "unknown");
  assert.equal(canApproveReportRevision(saved, "fnv1a-different").eligible, false);
  assert.equal(canApproveReportRevision(saved, "").eligible, false);
  assert.equal(canApproveReportRevision(saved, "fnv1a-12345678").eligible, true);
});

test("only valid human review transitions can approve without mutating immutable revision content", async () => {
  const source = revision();
  const checksum = await calculateReportRevisionChecksum(source);
  const saved = { ...source, contentChecksum: checksum };
  const lifecycle = { status: "draft", revision: saved };
  assert.equal(canTransitionReportLifecycle("draft", "approved"), false);
  const reviewing = transitionReportLifecycle(lifecycle, "in_review", { at: "2026-10-25T13:00:00.000Z" });
  assert.equal(reviewing.ok, true);
  const rejected = transitionReportLifecycle(reviewing.lifecycle, "approved", { actor: { kind: "human", name: "Reviewer" }, currentFingerprint: "stale" });
  assert.equal(rejected.ok, false);
  const approved = transitionReportLifecycle(reviewing.lifecycle, "approved", { actor: { kind: "human", name: "Reviewer" }, currentFingerprint: saved.source.fingerprint, at: "2026-10-25T14:00:00.000Z" });
  assert.equal(approved.ok, true);
  assert.equal(approved.lifecycle.review.reviewedBy, "Reviewer");
  assert.deepEqual(approved.lifecycle.revision, saved);
  assert.equal(transitionReportLifecycle(approved.lifecycle, "superseded", { at: "2026-10-25T15:00:00.000Z" }).ok, true);
  assert.equal(transitionReportLifecycle(approved.lifecycle, "withdrawn", { at: "2026-10-25T15:00:00.000Z" }).ok, true);
  assert.equal(transitionReportLifecycle({ ...approved.lifecycle, status: "superseded" }, "draft").ok, false);
});

test("matching immutable revision IDs with different checksums are import conflicts and history is never deleted", () => {
  const existing = [{ id: "revision-1", contentChecksum: `${REPORT_CHECKSUM_FORMAT}:${"a".repeat(64)}` }, { id: "revision-old", contentChecksum: `${REPORT_CHECKSUM_FORMAT}:${"b".repeat(64)}` }];
  const incoming = [{ id: "revision-1", contentChecksum: `${REPORT_CHECKSUM_FORMAT}:${"c".repeat(64)}` }, { id: "revision-old", contentChecksum: `${REPORT_CHECKSUM_FORMAT}:${"b".repeat(64)}` }];
  const result = findReportRevisionConflicts(existing, incoming);
  assert.equal(result.hasConflicts, true);
  assert.deepEqual(result.conflicts.map((conflict) => conflict.revisionId), ["revision-1"]);
  assert.deepEqual(result.matchingRevisionIds, ["revision-old"]);
  assert.equal(existing.length, 2);
});
