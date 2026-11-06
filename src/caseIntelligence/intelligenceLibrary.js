import {
  calculateIntelligenceChecksum,
  isIntelligenceChecksum,
  validateIntelligenceSerializable,
  verifyIntelligenceChecksum,
} from "./intelligenceChecksum.js";

export const INTELLIGENCE_LIBRARY_SCHEMA_VERSION = 1;
export const INTELLIGENCE_MESSAGE_ROLES = Object.freeze(["user", "assistant", "system_notice"]);
export const INTELLIGENCE_MESSAGE_STATES = Object.freeze(["complete", "failed", "cancelled"]);
export const INTELLIGENCE_CONVERSATION_STATES = Object.freeze(["active", "closed", "archived"]);
export const INTELLIGENCE_ITEM_TYPES = Object.freeze(["interpretation", "hypothesis", "alternative_explanation", "contradiction", "evidence_gap", "risk", "strategic_option", "open_question"]);
export const INTELLIGENCE_ITEM_STATES = Object.freeze(["open", "under_review", "confirmed_by_user", "rejected", "superseded", "archived"]);
export const INTELLIGENCE_DECISION_TYPES = Object.freeze(["confirmed_conclusion", "correction", "rejected_hypothesis", "approved_strategic_decision", "superseded_assessment"]);
export const INTELLIGENCE_REVIEW_STATES = Object.freeze(["unreviewed", "reviewed", "confirmed", "rejected"]);
export const INTELLIGENCE_MAX_MESSAGE_BYTES = 64 * 1024;
export const INTELLIGENCE_MAX_STATEMENT_BYTES = 32 * 1024;
export const INTELLIGENCE_MAX_CITATIONS = 100;
export const INTELLIGENCE_MAX_MESSAGES_PER_SESSION = 2000;
export const INTELLIGENCE_LIBRARY_WARNING_BYTES = 10 * 1024 * 1024;

const MAP_NAMES = Object.freeze(["conversations", "sessions", "messages", "intelligenceItems", "intelligenceItemRevisions", "decisions", "decisionRevisions"]);
const RECORD_TYPES = new Set(["issue", "party", "incident", "evidence", "document", "ledger", "task", "strategy", "watch", "goal"]);
const SOURCE_RELATIONS = new Set(["direct", "linked_context", "unresolved"]);
const ACTOR_KINDS = new Set(["user", "assistant", "system"]);

function text(value) { return typeof value === "string" ? value.trim() : ""; }
function list(value) { return Array.isArray(value) ? value : []; }
function isObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
function isTimestamp(value) { return typeof value === "string" && value.trim() !== "" && !Number.isNaN(Date.parse(value)); }
function byteLength(value) { return new TextEncoder().encode(typeof value === "string" ? value : "").byteLength; }
function add(errors, prefix, result) { errors.push(...result.errors.map((error) => `${prefix}: ${error}`)); }
function sameValue(left, right) { return JSON.stringify(canonical(left)) === JSON.stringify(canonical(right)); }
function canonical(value) { if (value == null || typeof value !== "object") return value; if (Array.isArray(value)) return value.map(canonical); return Object.fromEntries(Object.keys(value).sort().map((name) => [name, canonical(value[name])])); }
function uniqueStrings(values) { return Array.isArray(values) && values.every((value) => text(value)) && new Set(values).size === values.length; }

export class IntelligenceLibraryConflictError extends Error {
  constructor(message) { super(message); this.name = "IntelligenceLibraryConflictError"; this.code = "INTELLIGENCE_LIBRARY_CONFLICT"; }
}

export function createEmptyIntelligenceLibrary(caseId) {
  if (!text(caseId)) throw new TypeError("Case ID is required for an Intelligence Library.");
  return Object.fromEntries([["schemaVersion", INTELLIGENCE_LIBRARY_SCHEMA_VERSION], ["caseId", text(caseId)], ...MAP_NAMES.map((name) => [name, {}])]);
}

function validateScope(scope, errors, label = "Source scope") {
  if (!isObject(scope)) { errors.push(`${label} must be an object.`); return; }
  if (scope.type === "case") return;
  if (scope.type === "issue" && text(scope.issueId)) return;
  errors.push(`${label} must be case or a canonical Issue scope.`);
}

export function validateIntelligenceCitation(citation) {
  const errors = [];
  if (!isObject(citation)) return { valid: false, errors: ["Citation must be an object."] };
  if (!RECORD_TYPES.has(citation.recordType)) errors.push("Citation record type is invalid.");
  if (!text(citation.recordId)) errors.push("Citation record ID is required.");
  if (!SOURCE_RELATIONS.has(citation.scopeRelation)) errors.push("Citation scope relation is invalid.");
  if (citation.issueId != null && !text(citation.issueId)) errors.push("Citation Issue ID must be non-empty when supplied.");
  if (citation.capturedLabel != null && !text(citation.capturedLabel)) errors.push("Citation captured label must be non-empty when supplied.");
  if (citation.capturedAt != null && !isTimestamp(citation.capturedAt)) errors.push("Citation captured timestamp is invalid.");
  if (citation.availability != null && !["available", "missing", "unresolved"].includes(citation.availability)) errors.push("Citation availability is invalid.");
  add(errors, "Citation", validateIntelligenceSerializable(citation, { path: "citation" }));
  return { valid: errors.length === 0, errors };
}

function validateSource(source) {
  const errors = [];
  if (!isObject(source)) return { valid: false, errors: ["Source must be an object."] };
  if (!Number.isSafeInteger(source.caseRevision) || source.caseRevision < 1) errors.push("Source case revision must be a positive integer.");
  if (!text(source.sourceFingerprint)) errors.push("Source fingerprint is required.");
  validateScope(source.scope, errors);
  return { valid: errors.length === 0, errors };
}

function validateCitations(citations, errors, label) {
  if (!Array.isArray(citations)) { errors.push(`${label} citations must be an array.`); return; }
  if (citations.length > INTELLIGENCE_MAX_CITATIONS) errors.push(`${label} has too many citations.`);
  const seen = new Set();
  citations.forEach((citation, index) => {
    add(errors, `${label} citation ${index}`, validateIntelligenceCitation(citation));
    const citationKey = `${citation?.recordType}:${citation?.recordId}:${citation?.scopeRelation}`;
    if (seen.has(citationKey)) errors.push(`${label} contains a duplicate citation.`);
    seen.add(citationKey);
  });
}

function validateActor(actor, errors, { requireUser = false } = {}) {
  if (!isObject(actor)) { errors.push("Author must be an object."); return; }
  if (!ACTOR_KINDS.has(actor.kind)) errors.push("Author kind is invalid.");
  if (requireUser && actor.kind !== "user") errors.push("Decision revisions require explicit user attribution.");
  if (!text(actor.label)) errors.push("Author label is required.");
}

export function buildIntelligenceMessageChecksumPayload(message) {
  const validation = validateIntelligenceMessage({ ...message, contentChecksum: message?.contentChecksum || "sha256-intelligence-content-v1:" + "0".repeat(64) });
  if (!validation.valid) throw new TypeError(`Invalid intelligence message: ${validation.errors.join(" ")}`);
  return {
    type: "message", id: message.id, caseId: message.caseId, conversationId: message.conversationId, sessionId: message.sessionId,
    sequence: message.sequence, role: message.role, createdAt: message.createdAt, status: message.status,
    content: message.content, source: message.source, citations: message.citations, provider: message.provider || null,
  };
}

export function buildIntelligenceRevisionChecksumPayload(revision) {
  const validation = validateIntelligenceRevision({ ...revision, contentChecksum: revision?.contentChecksum || "sha256-intelligence-content-v1:" + "0".repeat(64) });
  if (!validation.valid) throw new TypeError(`Invalid intelligence revision: ${validation.errors.join(" ")}`);
  return {
    type: revision.entityType, id: revision.id, entityId: revision.entityId, caseId: revision.caseId, versionNumber: revision.versionNumber,
    parentRevisionId: revision.parentRevisionId || null, createdAt: revision.createdAt, author: revision.author,
    content: revision.content, source: revision.source, citations: revision.citations, review: revision.review,
  };
}

export async function calculateIntelligenceMessageChecksum(message) { return calculateIntelligenceChecksum(buildIntelligenceMessageChecksumPayload(message)); }
export async function calculateIntelligenceRevisionChecksum(revision) { return calculateIntelligenceChecksum(buildIntelligenceRevisionChecksumPayload(revision)); }

export async function verifyIntelligenceMessageChecksum(message) {
  const validation = validateIntelligenceMessage(message);
  if (!validation.valid) return validation;
  return verifyIntelligenceChecksum(buildIntelligenceMessageChecksumPayload(message), message.contentChecksum);
}

export async function verifyIntelligenceRevisionChecksum(revision) {
  const validation = validateIntelligenceRevision(revision);
  if (!validation.valid) return validation;
  return verifyIntelligenceChecksum(buildIntelligenceRevisionChecksumPayload(revision), revision.contentChecksum);
}

export function validateIntelligenceConversation(conversation) {
  const errors = [];
  if (!isObject(conversation)) return { valid: false, errors: ["Conversation must be an object."] };
  for (const [value, label] of [[conversation.id, "Conversation ID"], [conversation.caseId, "Conversation case ID"]]) if (!text(value)) errors.push(`${label} is required.`);
  if (conversation.title != null && !text(conversation.title)) errors.push("Conversation title must be non-empty when supplied.");
  if (!isTimestamp(conversation.createdAt) || !isTimestamp(conversation.updatedAt)) errors.push("Conversation timestamps are invalid.");
  if (!INTELLIGENCE_CONVERSATION_STATES.includes(conversation.status)) errors.push("Conversation status is invalid.");
  if (!uniqueStrings(conversation.sessionIds)) errors.push("Conversation session IDs must be a unique array of non-empty strings.");
  if (conversation.activeSessionId != null && !text(conversation.activeSessionId)) errors.push("Active session ID must be non-empty when supplied.");
  add(errors, "Conversation", validateIntelligenceSerializable(conversation, { path: "conversation" }));
  return { valid: errors.length === 0, errors };
}

export function validateIntelligenceSession(session) {
  const errors = [];
  if (!isObject(session)) return { valid: false, errors: ["Session must be an object."] };
  for (const [value, label] of [[session.id, "Session ID"], [session.caseId, "Session case ID"], [session.conversationId, "Session conversation ID"]]) if (!text(value)) errors.push(`${label} is required.`);
  if (!isTimestamp(session.startedAt) || (session.endedAt != null && !isTimestamp(session.endedAt))) errors.push("Session timestamps are invalid.");
  if (!uniqueStrings(session.messageIds)) errors.push("Session message IDs must be a unique array of non-empty strings.");
  if (Array.isArray(session.messageIds) && session.messageIds.length > INTELLIGENCE_MAX_MESSAGES_PER_SESSION) {
    errors.push(`Session cannot contain more than ${INTELLIGENCE_MAX_MESSAGES_PER_SESSION} messages.`);
  }
  add(errors, "Session source", validateSource(session.source));
  add(errors, "Session", validateIntelligenceSerializable(session, { path: "session" }));
  return { valid: errors.length === 0, errors };
}

export function validateIntelligenceMessage(message) {
  const errors = [];
  if (!isObject(message)) return { valid: false, errors: ["Message must be an object."] };
  for (const [value, label] of [[message.id, "Message ID"], [message.caseId, "Message case ID"], [message.conversationId, "Message conversation ID"], [message.sessionId, "Message session ID"]]) if (!text(value)) errors.push(`${label} is required.`);
  if (!Number.isSafeInteger(message.sequence) || message.sequence < 1) errors.push("Message sequence must be a positive integer.");
  if (!INTELLIGENCE_MESSAGE_ROLES.includes(message.role)) errors.push("Message role is invalid.");
  if (!INTELLIGENCE_MESSAGE_STATES.includes(message.status)) errors.push("Message status is invalid.");
  if (!isTimestamp(message.createdAt)) errors.push("Message creation timestamp is invalid.");
  if (!isObject(message.content) || typeof message.content.text !== "string") errors.push("Message content text is required.");
  else if (byteLength(message.content.text) > INTELLIGENCE_MAX_MESSAGE_BYTES) errors.push("Message text exceeds the maximum size.");
  if (message.content?.errorCode != null && !text(message.content.errorCode)) errors.push("Message error code must be non-empty when supplied.");
  if (message.content?.errorMessage != null && (typeof message.content.errorMessage !== "string" || byteLength(message.content.errorMessage) > INTELLIGENCE_MAX_MESSAGE_BYTES)) errors.push("Message error metadata is invalid.");
  add(errors, "Message source", validateSource(message.source));
  validateCitations(message.citations, errors, "Message");
  if (message.provider != null && !isObject(message.provider)) errors.push("Provider metadata must be an object when supplied.");
  if (!isIntelligenceChecksum(message.contentChecksum)) errors.push("Message content checksum is invalid.");
  add(errors, "Message", validateIntelligenceSerializable(message, { path: "message" }));
  return { valid: errors.length === 0, errors };
}

export function validateIntelligenceRevision(revision) {
  const errors = [];
  if (!isObject(revision)) return { valid: false, errors: ["Intelligence revision must be an object."] };
  if (!["item", "decision"].includes(revision.entityType)) errors.push("Revision entity type is invalid.");
  for (const [value, label] of [[revision.id, "Revision ID"], [revision.entityId, "Revision entity ID"], [revision.caseId, "Revision case ID"]]) if (!text(value)) errors.push(`${label} is required.`);
  if (!Number.isSafeInteger(revision.versionNumber) || revision.versionNumber < 1) errors.push("Revision version number must be a positive integer.");
  if (revision.parentRevisionId != null && !text(revision.parentRevisionId)) errors.push("Revision parent ID must be non-empty when supplied.");
  if (!isTimestamp(revision.createdAt)) errors.push("Revision creation timestamp is invalid.");
  validateActor(revision.author, errors, { requireUser: revision.entityType === "decision" });
  if (!isObject(revision.content) || typeof revision.content.statement !== "string") errors.push("Revision statement is required.");
  else if (byteLength(revision.content.statement) > INTELLIGENCE_MAX_STATEMENT_BYTES) errors.push("Revision statement exceeds the maximum size.");
  if (!["unknown", "low", "medium", "high"].includes(revision.content?.uncertainty)) errors.push("Revision uncertainty is invalid.");
  if (revision.content?.confidence != null && (!Number.isFinite(revision.content.confidence) || revision.content.confidence < 0 || revision.content.confidence > 1)) errors.push("Revision confidence must be a number from 0 to 1 when supplied.");
  add(errors, "Revision source", validateSource(revision.source));
  validateCitations(revision.citations, errors, "Revision");
  if (!isObject(revision.review) || !INTELLIGENCE_REVIEW_STATES.includes(revision.review.status)) errors.push("Revision review status is invalid.");
  if (revision.review?.by != null && !text(revision.review.by)) errors.push("Revision reviewer must be non-empty when supplied.");
  if (revision.review?.at != null && !isTimestamp(revision.review.at)) errors.push("Revision review timestamp is invalid.");
  if (!isIntelligenceChecksum(revision.contentChecksum)) errors.push("Revision content checksum is invalid.");
  add(errors, "Revision", validateIntelligenceSerializable(revision, { path: "revision" }));
  return { valid: errors.length === 0, errors };
}

function validateManifest(manifest, entityType) {
  const errors = [];
  if (!isObject(manifest)) return { valid: false, errors: [`${entityType} manifest must be an object.`] };
  for (const [value, label] of [[manifest.id, `${entityType} ID`], [manifest.caseId, `${entityType} case ID`], [manifest.currentRevisionId, `${entityType} current revision ID`]]) if (!text(value)) errors.push(`${label} is required.`);
  if (!isTimestamp(manifest.createdAt)) errors.push(`${entityType} creation timestamp is invalid.`);
  if (entityType === "item" && !INTELLIGENCE_ITEM_TYPES.includes(manifest.type)) errors.push("Intelligence item type is invalid.");
  if (entityType === "item" && !INTELLIGENCE_ITEM_STATES.includes(manifest.status)) errors.push("Intelligence item status is invalid.");
  if (entityType === "decision" && !INTELLIGENCE_DECISION_TYPES.includes(manifest.type)) errors.push("Decision type is invalid.");
  if (!uniqueStrings(manifest.revisionIds)) errors.push(`${entityType} revision IDs must be a unique array of non-empty strings.`);
  else if (!manifest.revisionIds.includes(manifest.currentRevisionId)) errors.push(`${entityType} current revision ID must be listed.`);
  add(errors, `${entityType} manifest`, validateIntelligenceSerializable(manifest, { path: `${entityType}Manifest` }));
  return { valid: errors.length === 0, errors };
}

function validateRevisionGraph(revisions, manifests, entityType, caseId, errors) {
  const revisionsByEntity = new Map();
  Object.entries(revisions).forEach(([id, revision]) => {
    if (!isObject(revision) || revision.id !== id) errors.push(`Revision map key ${id} does not match its embedded ID.`);
    add(errors, `Revision ${id}`, validateIntelligenceRevision(revision));
    if (revision?.entityType !== entityType) errors.push(`Revision ${id} has the wrong entity type.`);
    if (revision?.caseId !== caseId) errors.push(`Revision ${id} belongs to a different case.`);
    const values = revisionsByEntity.get(revision?.entityId) || [];
    values.push(revision);
    revisionsByEntity.set(revision?.entityId, values);
  });
  Object.entries(manifests).forEach(([id, manifest]) => {
    if (!isObject(manifest) || manifest.id !== id) errors.push(`${entityType} manifest map key ${id} does not match its embedded ID.`);
    add(errors, `${entityType} ${id}`, validateManifest(manifest, entityType));
    if (manifest?.caseId !== caseId) errors.push(`${entityType} ${id} belongs to a different case.`);
    const entityRevisions = revisionsByEntity.get(id) || [];
    const revisionIds = new Set(entityRevisions.map((revision) => revision.id));
    for (const revisionId of list(manifest?.revisionIds)) if (!revisionIds.has(revisionId)) errors.push(`${entityType} ${id} references a missing revision ${revisionId}.`);
    if (entityRevisions.length !== list(manifest?.revisionIds).length) errors.push(`${entityType} ${id} has an incomplete revision history.`);
    const sorted = [...entityRevisions].sort((left, right) => left.versionNumber - right.versionNumber);
    sorted.forEach((revision, index) => {
      const expectedVersion = index + 1;
      if (revision.versionNumber !== expectedVersion) errors.push(`${entityType} ${id} revision numbers must be sequential.`);
      const expectedParent = index ? sorted[index - 1].id : null;
      if ((revision.parentRevisionId || null) !== expectedParent) errors.push(`${entityType} ${id} revision parent chain is invalid.`);
    });
    if (sorted.length && manifest?.currentRevisionId !== sorted.at(-1)?.id) errors.push(`${entityType} ${id} current revision must be the latest revision.`);
  });
  Object.values(revisions).forEach((revision) => {
    if (!manifests[revision?.entityId]) errors.push(`Revision ${revision?.id || "unknown"} has no parent ${entityType} manifest.`);
  });
}

export function classifyIntelligenceLibrary(library, { caseId = "" } = {}) {
  if (library == null) return { kind: "absent", valid: true, errors: [] };
  if (!isObject(library)) return { kind: "malformed", valid: false, errors: ["Intelligence Library must be an object."] };
  if (!Number.isSafeInteger(library.schemaVersion)) return { kind: "malformed", valid: false, errors: ["Intelligence Library schema version must be an integer."] };
  if (library.schemaVersion > INTELLIGENCE_LIBRARY_SCHEMA_VERSION) return { kind: "unsupported", valid: false, errors: [`Intelligence Library schema version ${library.schemaVersion} is not supported.`] };
  if (library.schemaVersion !== INTELLIGENCE_LIBRARY_SCHEMA_VERSION) return { kind: "malformed", valid: false, errors: ["Unsupported or missing Intelligence Library schema version."] };
  const errors = [];
  if (!text(library.caseId)) errors.push("Intelligence Library case ID is required.");
  if (caseId && library.caseId !== caseId) errors.push("Intelligence Library belongs to a different case.");
  MAP_NAMES.forEach((name) => { if (!isObject(library[name])) errors.push(`Intelligence Library ${name} must be an object map.`); });
  if (errors.length) return { kind: "malformed", valid: false, errors };
  Object.entries(library.conversations).forEach(([id, conversation]) => {
    if (!isObject(conversation) || conversation.id !== id) errors.push(`Conversation map key ${id} does not match its embedded ID.`);
    add(errors, `Conversation ${id}`, validateIntelligenceConversation(conversation));
    if (conversation?.caseId !== library.caseId) errors.push(`Conversation ${id} belongs to a different case.`);
  });
  const referencedMessages = new Set();
  Object.entries(library.sessions).forEach(([id, session]) => {
    if (!isObject(session) || session.id !== id) errors.push(`Session map key ${id} does not match its embedded ID.`);
    add(errors, `Session ${id}`, validateIntelligenceSession(session));
    if (session?.caseId !== library.caseId) errors.push(`Session ${id} belongs to a different case.`);
    const conversation = library.conversations[session?.conversationId];
    if (!conversation || !conversation.sessionIds?.includes(id)) errors.push(`Session ${id} is not owned by its conversation.`);
    list(session?.messageIds).forEach((messageId) => {
      if (referencedMessages.has(messageId)) errors.push(`Message ${messageId} is listed by more than one session.`);
      referencedMessages.add(messageId);
    });
  });
  Object.entries(library.conversations).forEach(([id, conversation]) => {
    list(conversation?.sessionIds).forEach((sessionId) => { if (!library.sessions[sessionId]) errors.push(`Conversation ${id} references a missing session ${sessionId}.`); });
    if (conversation?.activeSessionId && !conversation.sessionIds?.includes(conversation.activeSessionId)) errors.push(`Conversation ${id} active session is not listed.`);
  });
  Object.entries(library.messages).forEach(([id, message]) => {
    if (!isObject(message) || message.id !== id) errors.push(`Message map key ${id} does not match its embedded ID.`);
    add(errors, `Message ${id}`, validateIntelligenceMessage(message));
    const session = library.sessions[message?.sessionId];
    if (message?.caseId !== library.caseId) errors.push(`Message ${id} belongs to a different case.`);
    if (!session || session.conversationId !== message?.conversationId || !session.messageIds?.includes(id)) errors.push(`Message ${id} is not owned by its session.`);
    if (!referencedMessages.has(id)) errors.push(`Message ${id} is not listed by a session.`);
  });
  Object.values(library.sessions).forEach((session) => {
    const sequences = list(session?.messageIds).map((id) => library.messages[id]?.sequence);
    if (sequences.some((value) => !Number.isSafeInteger(value)) || sequences.some((value, index) => index > 0 && value <= sequences[index - 1])) errors.push(`Session ${session?.id || "unknown"} message ordering is invalid.`);
  });
  validateRevisionGraph(library.intelligenceItemRevisions, library.intelligenceItems, "item", library.caseId, errors);
  validateRevisionGraph(library.decisionRevisions, library.decisions, "decision", library.caseId, errors);
  add(errors, "Intelligence Library", validateIntelligenceSerializable(library, { path: "intelligenceLibrary" }));
  return { kind: errors.length ? "malformed" : "supported", valid: errors.length === 0, errors };
}

export async function validateIntelligenceLibraryIntegrity(library, options = {}) {
  const structural = classifyIntelligenceLibrary(library, options);
  if (structural.kind !== "supported") return structural;
  const errors = [];
  for (const [id, message] of Object.entries(library.messages)) add(errors, `Message ${id}`, await verifyIntelligenceMessageChecksum(message));
  for (const [id, revision] of Object.entries(library.intelligenceItemRevisions)) add(errors, `Intelligence revision ${id}`, await verifyIntelligenceRevisionChecksum(revision));
  for (const [id, revision] of Object.entries(library.decisionRevisions)) add(errors, `Decision revision ${id}`, await verifyIntelligenceRevisionChecksum(revision));
  return { kind: errors.length ? "malformed" : "supported", valid: errors.length === 0, errors };
}

function mergeOrderedAppend(left, right, label) {
  const shared = Math.min(left.length, right.length);
  for (let index = 0; index < shared; index += 1) if (left[index] !== right[index]) throw new IntelligenceLibraryConflictError(`${label} ordering conflicts.`);
  return left.length >= right.length ? [...left] : [...right];
}
function mergeImmutableMaps(left, right, checksumField, label) {
  const merged = { ...left };
  Object.entries(right).forEach(([id, value]) => {
    if (!merged[id]) { merged[id] = value; return; }
    if (checksumField ? merged[id][checksumField] !== value[checksumField] : !sameValue(merged[id], value)) throw new IntelligenceLibraryConflictError(`${label} ${id} conflicts.`);
  });
  return merged;
}
function mergeConversation(left, right) {
  const comparableLeft = { ...left }; const comparableRight = { ...right };
  delete comparableLeft.sessionIds; delete comparableLeft.updatedAt; delete comparableLeft.activeSessionId;
  delete comparableRight.sessionIds; delete comparableRight.updatedAt; delete comparableRight.activeSessionId;
  if (!sameValue(comparableLeft, comparableRight)) throw new IntelligenceLibraryConflictError(`Conversation ${left.id} conflicts.`);
  if (left.activeSessionId && right.activeSessionId && left.activeSessionId !== right.activeSessionId) throw new IntelligenceLibraryConflictError(`Conversation ${left.id} active session conflicts.`);
  return { ...left, sessionIds: mergeOrderedAppend(left.sessionIds, right.sessionIds, `Conversation ${left.id} session`), activeSessionId: right.activeSessionId || left.activeSessionId || null, updatedAt: Date.parse(left.updatedAt) >= Date.parse(right.updatedAt) ? left.updatedAt : right.updatedAt };
}
function mergeSession(left, right) {
  const comparableLeft = { ...left }; const comparableRight = { ...right };
  delete comparableLeft.messageIds; delete comparableRight.messageIds;
  if (!sameValue(comparableLeft, comparableRight)) throw new IntelligenceLibraryConflictError(`Session ${left.id} conflicts.`);
  return { ...left, messageIds: mergeOrderedAppend(left.messageIds, right.messageIds, `Session ${left.id} message`) };
}
function mergeRevisionManifest(left, right, label) {
  const comparableLeft = { ...left }; const comparableRight = { ...right };
  delete comparableLeft.revisionIds; delete comparableLeft.currentRevisionId;
  delete comparableRight.revisionIds; delete comparableRight.currentRevisionId;
  if (!sameValue(comparableLeft, comparableRight)) throw new IntelligenceLibraryConflictError(`${label} ${left.id} conflicts.`);
  const revisionIds = mergeOrderedAppend(left.revisionIds, right.revisionIds, `${label} ${left.id} revision`);
  const currentRevisionId = revisionIds.at(-1);
  if (![left.currentRevisionId, right.currentRevisionId].includes(currentRevisionId)) throw new IntelligenceLibraryConflictError(`${label} ${left.id} current revision conflicts.`);
  return { ...left, revisionIds, currentRevisionId };
}
function mergeMap(left, right, merger) {
  const merged = { ...left };
  Object.entries(right).forEach(([id, value]) => { merged[id] = merged[id] ? merger(merged[id], value) : value; });
  return merged;
}

export async function mergeIntelligenceLibraries(localLibrary, incomingLibrary, { caseId = "" } = {}) {
  const local = await validateIntelligenceLibraryIntegrity(localLibrary, { caseId });
  const incoming = await validateIntelligenceLibraryIntegrity(incomingLibrary, { caseId });
  if (incoming.kind === "absent") return local.kind === "absent" ? undefined : structuredClone(localLibrary);
  if (local.kind === "absent") return structuredClone(incomingLibrary);
  if (local.kind !== "supported") throw new IntelligenceLibraryConflictError(`Existing Intelligence Library cannot be merged: ${local.errors.join(" ")}`);
  if (incoming.kind !== "supported") throw new IntelligenceLibraryConflictError(`Incoming Intelligence Library cannot be merged: ${incoming.errors.join(" ")}`);
  const combined = {
    schemaVersion: INTELLIGENCE_LIBRARY_SCHEMA_VERSION,
    caseId: localLibrary.caseId,
    conversations: mergeMap(localLibrary.conversations, incomingLibrary.conversations, mergeConversation),
    sessions: mergeMap(localLibrary.sessions, incomingLibrary.sessions, mergeSession),
    messages: mergeImmutableMaps(localLibrary.messages, incomingLibrary.messages, "contentChecksum", "Message"),
    intelligenceItems: mergeMap(localLibrary.intelligenceItems, incomingLibrary.intelligenceItems, (left, right) => mergeRevisionManifest(left, right, "Intelligence item")),
    intelligenceItemRevisions: mergeImmutableMaps(localLibrary.intelligenceItemRevisions, incomingLibrary.intelligenceItemRevisions, "contentChecksum", "Intelligence revision"),
    decisions: mergeMap(localLibrary.decisions, incomingLibrary.decisions, (left, right) => mergeRevisionManifest(left, right, "Decision")),
    decisionRevisions: mergeImmutableMaps(localLibrary.decisionRevisions, incomingLibrary.decisionRevisions, "contentChecksum", "Decision revision"),
  };
  const validation = await validateIntelligenceLibraryIntegrity(combined, { caseId: caseId || combined.caseId });
  if (!validation.valid) throw new IntelligenceLibraryConflictError(`Combined Intelligence Library is invalid: ${validation.errors.join(" ")}`);
  return combined;
}

export function measureIntelligenceLibrary(library) {
  const bytes = byteLength(JSON.stringify(library));
  return { bytes, warning: bytes > INTELLIGENCE_LIBRARY_WARNING_BYTES, warningThresholdBytes: INTELLIGENCE_LIBRARY_WARNING_BYTES };
}
