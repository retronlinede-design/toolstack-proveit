import { Tags } from "lucide-react";
import AttachmentPreview from "../AttachmentPreview";
import RecordActions from "../shared/RecordActions.jsx";
import RecordBadge from "../shared/RecordBadge.jsx";
import RecordMetadataRow from "../shared/RecordMetadataRow.jsx";
import RecordLinksRow from "../shared/RecordLinksRow.jsx";
import RecordCardShell from "../shared/RecordCardShell.jsx";
import { getDocumentTextStatus } from "./trackingRecordHelpers";

function getDocumentStatusBadgeVariant(tone) {
  if (tone === "green") return "verification-verified";
  if (tone === "amber") return "verification-partial";
  return "verification-unverified";
}

function renderSequenceGroupChip(value) {
  const sequenceGroup = typeof value === "string" ? value.trim() : "";
  if (!sequenceGroup) return null;

  return (
    <RecordLinksRow groups={[{ key: "sequence-group", items: [{ key: "sequence", label: sequenceGroup, icon: <Tags />, variant: "sequence" }] }]} />
  );
}

export default function DocumentsTab({
  documents,
  expandedDocuments,
  imageCache,
  onAddDocument,
  onOpenDocument,
  onConvertDocument,
  onDeleteDocument,
  onToggleDocumentExpanded,
  onPreviewFile,
  getLinkedRecordMeta,
  onOpenLinkedRecord,
  parties = [],
}) {
  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold">Documents (Source Material)</h3>
          <p className="mt-1 text-sm text-neutral-500">
            Primary source documents first. GPT reasoning depends on captured text, not just attached files.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={onAddDocument}
            className="rounded-lg border border-lime-500 bg-white px-3 py-1 text-sm font-bold text-neutral-900 shadow-md hover:bg-lime-400/30 transition-all active:scale-95"
          >
            + Add Document
          </button>
        </div>
      </div>

      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-neutral-500">Documents (Source Material)</h3>
          <p className="mt-1 text-xs text-neutral-500">
            Add source letters, PDFs, emails, notices, screenshots, and written evidence here.
          </p>
        </div>

        {documents.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-5 text-sm text-neutral-600">
            No normal documents yet.
          </div>
        ) : (
          <div className="space-y-3">
            {documents.map((doc) => {
              const textStatus = getDocumentTextStatus(doc);
              const attachmentCount = Array.isArray(doc.attachments) ? doc.attachments.length : 0;
              const linkedCount = Array.isArray(doc.linkedRecordIds) ? doc.linkedRecordIds.length : 0;
              const resolvedRecordLinks = (doc.linkedRecordIds || []).map((id) => ({ id, record: getLinkedRecordMeta(id) })).filter((item) => item.record);
              const missingRecordLinkCount = linkedCount - resolvedRecordLinks.length;
              const linkedRecordItems = resolvedRecordLinks.slice(0, 4).map(({ id, record }) => ({
                key: id,
                label: `${record.typeLabel} · ${record.title || "Untitled record"}`,
                title: record.title || "Untitled record",
                variant: "linked",
                onClick: () => onOpenLinkedRecord(id),
              }));
              if (resolvedRecordLinks.length > 4) linkedRecordItems.push({ key: "remaining-records", label: `+${resolvedRecordLinks.length - 4}`, variant: "neutral" });
              if (missingRecordLinkCount > 0) linkedRecordItems.push({ key: "missing-records", label: `${missingRecordLinkCount} missing link${missingRecordLinkCount === 1 ? "" : "s"}`, variant: "missing", title: "Linked records that could not be resolved" });
              const partyById = new Map(parties.map((party) => [party.id, party]));
              const resolvedPartyLinks = (doc.linkedPartyIds || []).map((id) => partyById.get(id)).filter(Boolean);
              const missingPartyLinkCount = (doc.linkedPartyIds || []).length - resolvedPartyLinks.length;
              const partyLinkItems = resolvedPartyLinks.slice(0, 4).map((party) => ({ key: party.id, label: `Party · ${party.displayName || "Untitled Party"}`, title: party.displayName || "Untitled Party", variant: "party" }));
              if (resolvedPartyLinks.length > 4) partyLinkItems.push({ key: "remaining-parties", label: `+${resolvedPartyLinks.length - 4}`, variant: "neutral" });
              if (missingPartyLinkCount > 0) partyLinkItems.push({ key: "missing-parties", label: `${missingPartyLinkCount} missing part${missingPartyLinkCount === 1 ? "y" : "ies"}`, variant: "missing", title: "Related parties that could not be resolved" });

              return (
              <RecordCardShell
                key={doc.id}
                headingLevel={4}
                title={doc.title || "Untitled Document"}
                badges={<><RecordBadge variant={getDocumentStatusBadgeVariant(textStatus.tone)} className="shrink-0 uppercase tracking-wider">{textStatus.label}</RecordBadge>{renderSequenceGroupChip(doc.sequenceGroup)}</>}
                metadata={<RecordMetadataRow className="uppercase tracking-wider" items={[
                  { key: "document-date", value: doc.documentDate || "No date", emphasis: true },
                  { key: "document-type", render: <RecordBadge variant="type" className="uppercase tracking-wider">{doc.category || "other"}</RecordBadge> },
                  { key: "source", label: "Source", value: doc.source },
                ]} />}
                actions={<RecordActions
                    className="flex shrink-0 flex-wrap items-center gap-2 sm:flex-nowrap"
                    actions={[
                      { key: "open", label: "Open Document", variant: "primary", onClick: () => onOpenDocument(doc) },
                      { key: "edit", label: "Edit", onClick: () => onOpenDocument(doc) },
                      { key: "convert", label: "Convert", variant: "secondary", onClick: () => onConvertDocument?.(doc) },
                      { key: "delete", label: "Delete", variant: "danger", onClick: () => onDeleteDocument(doc) },
                    ]}
                  />}
              >

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <div className="hidden">
                    {textStatus.label}
                  </div>
                  <RecordLinksRow groups={[{ key: "relationship-counts", items: [
                    { key: "attachment-count", label: `${attachmentCount} attachment${attachmentCount === 1 ? "" : "s"}`, variant: "attachment" },
                    { key: "linked-count", label: `${linkedCount} linked record${linkedCount === 1 ? "" : "s"}`, variant: "linked" },
                  ] }]} />
                </div>

                {doc.summary && (
                  <p className="mt-3 border-l-2 border-neutral-200 pl-3 text-sm italic text-neutral-600 line-clamp-2">
                    {doc.summary}
                  </p>
                )}

              {doc.textContent && doc.textContent.trim() && (
                <div className="mt-4 pt-4 border-t border-neutral-100">
                  <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-neutral-400">Short Preview</div>
                  <div className="text-sm text-neutral-700 whitespace-pre-wrap">
                    {expandedDocuments[doc.id]
                      ? doc.textContent
                      : doc.textContent.slice(0, 280) + (doc.textContent.length > 280 ? "..." : "")}
                  </div>
                  {doc.textContent.length > 280 && (
                    <button
                      onClick={() => onToggleDocumentExpanded(doc.id)}
                      className="mt-2 text-xs font-bold text-lime-600 hover:text-lime-700 transition-colors"
                    >
                      {expandedDocuments[doc.id] ? "Show less" : "Show more"}
                    </button>
                  )}
                </div>
              )}

              {doc.attachments && doc.attachments.length > 0 && (
                <div className="mt-4 pt-4 border-t border-neutral-100">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Attachments</div>
                  </div>
                  <RecordLinksRow groups={[{ key: "attachment-preview", className: "rounded-2xl border border-neutral-200 bg-neutral-50/50 p-4 dark:border-neutral-700 dark:bg-neutral-800/50", render: <AttachmentPreview attachments={doc.attachments || []} imageCache={imageCache} onPreview={onPreviewFile} /> }]} />
                </div>
              )}

              {doc.linkedRecordIds && doc.linkedRecordIds.length > 0 && (
                <div className="mt-1 border-t border-neutral-100 pt-1">
                  <RecordLinksRow groups={[{ key: "linked-case-items", label: "Linked Case Items", items: linkedRecordItems }]} />
                </div>
              )}
              <RecordLinksRow className="mt-1" groups={[{ key: "linked-parties", label: "Linked Parties", items: partyLinkItems }]} />
            </RecordCardShell>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}
