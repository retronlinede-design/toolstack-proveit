import { useMemo, useState } from "react";
import { INTELLIGENCE_ITEM_TYPES } from "../../caseIntelligence/intelligenceLibrary.js";

function recordsForContext(context) {
  return Object.values(context?.inventory || {}).flat()
    .filter((record) => record?.recordType && record?.recordId)
    .sort((left, right) => `${left.recordType}:${left.recordId}`.localeCompare(`${right.recordType}:${right.recordId}`));
}
function revisionFor(library, item) { return library?.intelligenceItemRevisions?.[item.currentRevisionId] || null; }
function displayType(type) { return String(type || "").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }

/** UI only: CaseDetail supplies the controlled persistence callback. */
export default function IntelligenceLibraryPanel({
  context,
  library,
  provenanceByRevision = {},
  onCreateManualItem,
  feedback = "",
  saving = false,
  contextFreshness = "current",
}) {
  const [type, setType] = useState("hypothesis");
  const [statement, setStatement] = useState("");
  const [rationale, setRationale] = useState("");
  const [author, setAuthor] = useState("User");
  const [citationKeys, setCitationKeys] = useState([]);
  const [selectedItemId, setSelectedItemId] = useState("");
  const records = useMemo(() => recordsForContext(context), [context]);
  const items = useMemo(() => Object.values(library?.intelligenceItems || {})
    .map((item) => ({ item, revision: revisionFor(library, item) }))
    .filter(({ revision }) => revision)
    .sort((left, right) => String(right.revision.createdAt).localeCompare(String(left.revision.createdAt)) || left.item.id.localeCompare(right.item.id)), [library]);
  const selected = items.find(({ item }) => item.id === selectedItemId) || items[0] || null;
  const contextReady = Boolean(context?.scope?.valid) && contextFreshness === "current";
  const toggleCitation = (key) => setCitationKeys((current) => current.includes(key) ? current.filter((value) => value !== key) : [...current, key]);
  const submit = async (event) => {
    event.preventDefault();
    const saved = await onCreateManualItem?.({ type, statement, rationale, author, citationKeys });
    if (saved) { setStatement(""); setRationale(""); setCitationKeys([]); }
  };
  return <section data-intelligence-library aria-labelledby="intelligence-library-heading">
    <div data-intelligence-library-header>
      <div>
        <div className="case-file-ai-workspace-label">Case Intelligence Library</div>
        <h4 id="intelligence-library-heading">Local notes and reviewable working intelligence</h4>
        <p>Human-authored notes are captured against the current local context. They are not canonical case facts, AI conclusions, or external transmissions.</p>
      </div>
      <span data-intelligence-library-boundary>Local only · User-authored</span>
    </div>

    {!contextReady && <p data-intelligence-library-status role="status">{contextFreshness === "stale" ? "Context is stale. Refresh the Context Inspector before recording a note." : "A valid current context is required before recording a note."}</p>}
    {feedback && <p data-intelligence-library-feedback role="status" aria-live="polite">{feedback}</p>}

    <form data-intelligence-library-form onSubmit={submit}>
      <h5>Record a manual intelligence note</h5>
      <div data-intelligence-library-form-grid>
        <label><span>Type</span><select value={type} onChange={(event) => setType(event.target.value)} disabled={!contextReady || saving}>{INTELLIGENCE_ITEM_TYPES.map((value) => <option key={value} value={value}>{displayType(value)}</option>)}</select></label>
        <label><span>Human author</span><input value={author} onChange={(event) => setAuthor(event.target.value)} disabled={!contextReady || saving} autoComplete="name" /></label>
      </div>
      <label><span>Statement or note</span><textarea value={statement} onChange={(event) => setStatement(event.target.value)} disabled={!contextReady || saving} rows={3} required /></label>
      <label><span>Rationale (optional)</span><textarea value={rationale} onChange={(event) => setRationale(event.target.value)} disabled={!contextReady || saving} rows={2} /></label>
      <fieldset disabled={!contextReady || saving}>
        <legend>Explicit source citations (optional)</legend>
        <p>Only allowlisted records in the displayed scope can be cited. Direct Issue records and linked context remain distinct.</p>
        {records.length === 0 ? <p>No eligible records are available in this context.</p> : <div data-intelligence-library-citations>{records.map((record) => {
          const key = `${record.recordType}:${record.recordId}`;
          return <label key={key}><input type="checkbox" checked={citationKeys.includes(key)} onChange={() => toggleCitation(key)} /> <strong>{record.displayLabel}</strong> <small>{key} · {record.scopeRelation === "direct" ? "Direct" : "Linked context"}</small></label>;
        })}</div>}
      </fieldset>
      <p data-intelligence-library-provenance>Scope: {context?.scope?.label || "Unavailable"}. Source revision: {context?.source?.caseRevision ?? "Unavailable"}. A checksum and immutable revision are created only after a successful save.</p>
      <button type="submit" data-intelligence-library-create disabled={!contextReady || saving}>{saving ? "Saving note…" : "Save manual note"}</button>
    </form>

    <section data-intelligence-library-browser aria-labelledby="intelligence-library-browser-heading">
      <h5 id="intelligence-library-browser-heading">Saved intelligence items</h5>
      {items.length === 0 && <p data-intelligence-library-empty>No Intelligence Library items have been saved for this case.</p>}
      {items.length > 0 && <div data-intelligence-library-content>
        <div role="list" data-intelligence-library-list>{items.map(({ item, revision }) => {
          const provenance = provenanceByRevision[revision.id];
          return <button key={item.id} type="button" role="listitem" aria-pressed={selected?.item.id === item.id} onClick={() => setSelectedItemId(item.id)}>
            <strong>{displayType(item.type)}</strong><span>{revision.author?.kind === "user" ? "Human" : "Future AI"} · {revision.author?.label || "Unknown author"}</span><span>{new Date(revision.createdAt).toLocaleString()}</span><small>{item.status} · v{revision.versionNumber} · {provenance?.freshness?.state || "unknown"}</small>
          </button>;
        })}</div>
        {selected && <article data-intelligence-library-detail aria-live="polite">
          <div className="case-file-ai-workspace-label">Selected immutable revision</div>
          <h6>{displayType(selected.item.type)} · v{selected.revision.versionNumber}</h6>
          <p>{selected.revision.content.statement}</p>
          {selected.revision.content.rationale && <p><strong>Rationale:</strong> {selected.revision.content.rationale}</p>}
          <dl><div><dt>Author</dt><dd>{selected.revision.author.label} (human)</dd></div><div><dt>Review</dt><dd>{selected.revision.review.status}</dd></div><div><dt>Scope</dt><dd>{selected.revision.source.scope.label || (selected.revision.source.scope.type === "issue" ? `Issue ${selected.revision.source.scope.issueId}` : "Entire Case")}</dd></div><div><dt>Freshness</dt><dd>{provenanceByRevision[selected.revision.id]?.freshness?.state || "unknown"}</dd></div></dl>
          <p>Captured source revision: {selected.revision.source.caseRevision}; fingerprint: {selected.revision.source.sourceFingerprint}.</p>
          <h6>Citations</h6>
          {selected.revision.citations.length === 0 ? <p>No explicit citations were selected.</p> : <ul>{selected.revision.citations.map((citation) => {
            const assessment = (provenanceByRevision[selected.revision.id]?.citations || []).find((entry) => entry.citation.recordType === citation.recordType && entry.citation.recordId === citation.recordId && entry.citation.scopeRelation === citation.scopeRelation);
            return <li key={`${citation.recordType}:${citation.recordId}:${citation.scopeRelation}`}>{citation.capturedLabel} ({citation.recordType}:{citation.recordId}) · {citation.scopeRelation} · {assessment?.status || "unknown"}</li>;
          })}</ul>}
        </article>}
      </div>}
    </section>
  </section>;
}
