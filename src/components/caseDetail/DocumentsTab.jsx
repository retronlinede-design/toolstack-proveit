import { ChevronDown, Search, Tags } from "lucide-react";
import { useMemo, useState } from "react";

import AttachmentPreview from "../AttachmentPreview";
import RecordActions from "../shared/RecordActions.jsx";
import RecordBadge from "../shared/RecordBadge.jsx";
import RecordMetadataRow from "../shared/RecordMetadataRow.jsx";
import RecordLinksRow from "../shared/RecordLinksRow.jsx";
import RecordCardShell from "../shared/RecordCardShell.jsx";
import { getDocumentTextStatus } from "./trackingRecordHelpers";

function readinessLabel(status) { return status.tone === "green" ? "Captured text: ready" : status.tone === "amber" ? "Captured text: partial" : "Captured text: not available"; }
function readinessVariant(status) { return status.tone === "amber" ? "status-warning" : status.tone === "red" ? "status-neutral" : "status-positive"; }
function preview(value) { const text = typeof value === "string" ? value.trim() : ""; return text.length > 240 ? `${text.slice(0, 240)}…` : text; }

export default function DocumentsTab({ documents, expandedDocuments, imageCache, onAddDocument, onOpenDocument, onConvertDocument, onDeleteDocument, onToggleDocumentExpanded, onPreviewFile, getLinkedRecordMeta, onOpenLinkedRecord, parties = [] }) {
  const [search, setSearch] = useState("");
  const [issueFilter, setIssueFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [readinessFilter, setReadinessFilter] = useState("all");
  const issueLabels = useMemo(() => [...new Set(documents.map((doc) => String(doc.sequenceGroup || "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b)), [documents]);
  const categories = useMemo(() => [...new Set(documents.map((doc) => String(doc.category || "other"))).values()].sort((a, b) => a.localeCompare(b)), [documents]);
  const filteredDocuments = documents.filter((doc) => {
    const status = getDocumentTextStatus(doc);
    const haystack = [doc.title, doc.summary, doc.textContent, doc.source, doc.category, doc.sequenceGroup].filter(Boolean).join(" ").toLowerCase();
    return (!search.trim() || haystack.includes(search.trim().toLowerCase()))
      && !(issueFilter === "__unassigned__" && String(doc.sequenceGroup || "").trim())
      && !(issueFilter !== "all" && issueFilter !== "__unassigned__" && doc.sequenceGroup !== issueFilter)
      && !(categoryFilter !== "all" && (doc.category || "other") !== categoryFilter)
      && !(readinessFilter !== "all" && status.tone !== readinessFilter);
  });
  const filtersActive = search || issueFilter !== "all" || categoryFilter !== "all" || readinessFilter !== "all";
  const clearFilters = () => { setSearch(""); setIssueFilter("all"); setCategoryFilter("all"); setReadinessFilter("all"); };

  return <div className="case-file-documents space-y-5">
    <section className="case-file-documents-header rounded-2xl border border-neutral-200 bg-neutral-50 p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><p className="case-file-documents-eyebrow">Source material</p><h3 className="mt-1 text-xl font-semibold text-neutral-950">Documents</h3><p className="mt-1 text-sm text-neutral-600">Capture useful source text; attachments alone are not text-ready for case reasoning.</p></div><div className="flex flex-wrap items-center gap-2"><span className="text-xs font-medium text-neutral-500">{filteredDocuments.length} shown of {documents.length}</span><button type="button" onClick={onAddDocument} className="case-file-documents-primary-action">+ New Document</button></div></div>
    </section>
    <section className="case-file-documents-controls rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm" aria-label="Document filters">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_repeat(3,minmax(9rem,.42fr))_auto] lg:items-end">
        <label className="case-file-documents-filter-label" htmlFor="document-search">Search documents<span className="case-file-documents-search mt-2"><Search aria-hidden="true" /><input id="document-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search title, summary, text, source, category, or Issue" /></span></label>
        <label className="case-file-documents-filter-label">Issue<select value={issueFilter} onChange={(event) => setIssueFilter(event.target.value)} className="case-file-documents-select mt-2"><option value="all">All Issues</option><option value="__unassigned__">Without an Issue</option>{issueLabels.map((label) => <option key={label} value={label}>{label}</option>)}</select></label>
        <label className="case-file-documents-filter-label">Category<select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className="case-file-documents-select mt-2"><option value="all">All categories</option>{categories.map((category) => <option key={category} value={category}>{category}</option>)}</select></label>
        <label className="case-file-documents-filter-label">Captured text<select value={readinessFilter} onChange={(event) => setReadinessFilter(event.target.value)} className="case-file-documents-select mt-2"><option value="all">All states</option><option value="green">Ready</option><option value="amber">Partial</option><option value="red">Not available</option></select></label>
        {filtersActive && <button type="button" className="case-file-documents-clear" onClick={clearFilters}>Clear</button>}
      </div>
    </section>
    <section className="case-file-documents-list space-y-3" aria-live="polite">
      {filteredDocuments.length === 0 ? <div className="case-file-documents-empty rounded-2xl border border-dashed border-neutral-300 p-5 text-sm text-neutral-600">{documents.length ? "No documents match these filters." : "No normal source documents yet. Add a document to capture source material."}</div> : filteredDocuments.map((doc) => {
        const textStatus = getDocumentTextStatus(doc); const attachmentCount = Array.isArray(doc.attachments) ? doc.attachments.length : 0; const linkedCount = Array.isArray(doc.linkedRecordIds) ? doc.linkedRecordIds.length : 0; const expanded = Boolean(expandedDocuments[doc.id]); const detailId = `document-details-${doc.id}`;
        const resolvedRecordLinks = (doc.linkedRecordIds || []).map((id) => ({ id, record: getLinkedRecordMeta(id) })).filter((item) => item.record);
        const linkedRecordItems = resolvedRecordLinks.slice(0, 4).map(({ id, record }) => ({ key: id, label: `${record.typeLabel} · ${record.title || "Untitled record"}`, variant: "linked", onClick: () => onOpenLinkedRecord(id) }));
        const missingRecordLinkCount = linkedCount - resolvedRecordLinks.length; if (missingRecordLinkCount > 0) linkedRecordItems.push({ key: "missing-records", label: `${missingRecordLinkCount} missing link${missingRecordLinkCount === 1 ? "" : "s"}`, variant: "missing" });
        const partyById = new Map(parties.map((party) => [party.id, party])); const resolvedParties = (doc.linkedPartyIds || []).map((id) => partyById.get(id)).filter(Boolean); const partyItems = resolvedParties.slice(0, 4).map((party) => ({ key: party.id, label: `Party · ${party.displayName || "Untitled Party"}`, variant: "party" }));
        const missingPartyCount = (doc.linkedPartyIds || []).length - resolvedParties.length; if (missingPartyCount > 0) partyItems.push({ key: "missing-parties", label: `${missingPartyCount} missing part${missingPartyCount === 1 ? "y" : "ies"}`, variant: "missing" });
        const title = doc.title || "Untitled Document";
        return <RecordCardShell key={doc.id} id={`document-${doc.id}`} headingLevel={4} title={title} subtitle={<span className="case-file-documents-preview">{preview(doc.summary || doc.textContent || "No summary recorded.")}</span>} expanded={expanded} className="case-file-document-card"
          badges={<><RecordBadge variant="type" className="uppercase tracking-wider">{doc.category || "other"}</RecordBadge><RecordBadge variant={readinessVariant(textStatus)}>{readinessLabel(textStatus)}</RecordBadge>{doc.sequenceGroup && <RecordLinksRow groups={[{ key: "sequence-group", items: [{ key: "sequence", label: doc.sequenceGroup, icon: <Tags />, variant: "sequence" }] }]} />}</>}
          metadata={<RecordMetadataRow items={[{ key: "document-date", label: "Date", value: doc.documentDate || "Not recorded" }, { key: "source", label: "Source", value: doc.source || "Not recorded" }, { key: "attachment-count", label: "Attachment records", value: `${attachmentCount}` }, { key: "linked-count", label: "Linked records", value: `${linkedCount}` }]} />}
          actions={<RecordActions className="case-file-document-actions grid grid-cols-2 gap-1 sm:min-w-44" actions={[{ key: "open", label: "Open", "aria-label": `Open document ${title}`, variant: "primary", onClick: () => onOpenDocument(doc) }, { key: "edit", label: "Edit", "aria-label": `Edit document ${title}`, onClick: () => onOpenDocument(doc) }, { key: "convert", label: "Convert", "aria-label": `Convert document ${title}`, variant: "secondary", onClick: () => onConvertDocument?.(doc) }, { key: "delete", label: "Delete", "aria-label": `Delete document ${title}`, variant: "danger", onClick: () => onDeleteDocument(doc) }]} />}
        ><div id={detailId} className="case-file-document-details">{expanded && <div className="space-y-4">{doc.summary && <section><h5>Summary</h5><p>{doc.summary}</p></section>}{doc.textContent && <section><h5>Captured text</h5><p className="case-file-document-text">{doc.textContent}</p></section>}{doc.attachments?.length > 0 && <RecordLinksRow groups={[{ key: "attachment-preview", label: "Attachment records", render: <AttachmentPreview attachments={doc.attachments} imageCache={imageCache} onPreview={onPreviewFile} /> }]} />}<RecordLinksRow groups={[{ key: "linked-case-items", label: "Linked Case Items", items: linkedRecordItems }, { key: "linked-parties", label: "Linked Parties", items: partyItems }]} /></div>}</div><button type="button" className="case-file-document-disclosure" aria-expanded={expanded} aria-controls={detailId} onClick={() => onToggleDocumentExpanded(doc.id)}><ChevronDown className={expanded ? "is-expanded" : ""} aria-hidden="true" />{expanded ? "Hide document details" : "Show document details"}</button></RecordCardShell>;
      })}
    </section>
  </div>;
}
