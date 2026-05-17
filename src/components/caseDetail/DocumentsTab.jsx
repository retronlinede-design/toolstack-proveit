import { Tags } from "lucide-react";
import AttachmentPreview from "../AttachmentPreview";
import { getLinkChipClasses } from "../linkChipStyles";
import LinkedChip from "../LinkedChip";
import {
  getDocumentStatusClasses,
  getDocumentTextStatus,
} from "./trackingRecordHelpers";

function renderCompactLinkRow(label, items, renderChip) {
  if (!items || items.length === 0) return null;
  const renderedChips = items.map(renderChip).filter(Boolean);
  const visibleChips = renderedChips.slice(0, 4);
  const remainingCount = renderedChips.length - visibleChips.length;
  const missingCount = items.length - renderedChips.length;

  if (renderedChips.length === 0 && missingCount === 0) return null;

  return (
    <div className="mt-1 flex items-start gap-2">
      <div className="w-24 shrink-0 pt-0.5 text-[11px] text-neutral-500">{label}</div>
      <div className="flex flex-wrap gap-1">
        {visibleChips}
        {remainingCount > 0 && (
          <span className={getLinkChipClasses("neutral")}>
            +{remainingCount}
          </span>
        )}
        {missingCount > 0 && (
          <span className={getLinkChipClasses("neutral", "cursor-default opacity-70")}>
            {missingCount} missing link{missingCount === 1 ? "" : "s"}
          </span>
        )}
      </div>
    </div>
  );
}

function renderSequenceGroupChip(value) {
  const sequenceGroup = typeof value === "string" ? value.trim() : "";
  if (!sequenceGroup) return null;

  return (
    <span className="inline-flex max-w-full items-center gap-1 rounded border border-neutral-200 bg-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-neutral-600">
      <Tags className="h-3 w-3 shrink-0 text-neutral-400" aria-hidden="true" />
      <span className="truncate">{sequenceGroup}</span>
    </span>
  );
}

export default function DocumentsTab({
  documents,
  expandedDocuments,
  imageCache,
  onAddDocument,
  onOpenDocument,
  onDeleteDocument,
  onToggleDocumentExpanded,
  onPreviewFile,
  getLinkedRecordMeta,
  onOpenLinkedRecord,
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

              return (
              <div key={doc.id} className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="min-w-0 flex-1 truncate font-semibold text-neutral-900">{doc.title || "Untitled Document"}</h4>
                      <span className={`shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${getDocumentStatusClasses(textStatus.tone)}`}>
                        {textStatus.label}
                      </span>
                      {renderSequenceGroupChip(doc.sequenceGroup)}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                      <span className="text-neutral-600">{doc.documentDate || "No date"}</span>
                      <span className="rounded border border-neutral-200 bg-neutral-100 px-1.5 py-0.5">{doc.category || "other"}</span>
                      {doc.source && <span>Source: {doc.source}</span>}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      onClick={() => onOpenDocument(doc)}
                      className="rounded-lg border border-lime-500 bg-lime-50 px-2 py-0.5 text-[10px] font-bold text-lime-800 shadow-sm hover:bg-lime-100 transition-colors"
                    >
                      Open Document
                    </button>
                    <button
                      onClick={() => onOpenDocument(doc)}
                      className="rounded-lg border border-neutral-300 bg-white px-2 py-0.5 text-[10px] font-bold text-neutral-700 shadow-sm hover:bg-neutral-50 transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => onDeleteDocument(doc)}
                      className="rounded-lg border border-red-300 bg-white px-2 py-0.5 text-[10px] font-bold text-red-700 shadow-sm hover:bg-red-50 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <div className="hidden">
                    {textStatus.label}
                  </div>
                  <div className="rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1 text-xs font-medium text-neutral-600">
                    <div>
                      {attachmentCount} attachment{attachmentCount === 1 ? "" : "s"} Â· {linkedCount} linked record{linkedCount === 1 ? "" : "s"}
                    </div>
                    <div className="hidden">
                      {attachmentCount > 0 && textStatus.charCount === 0 ? "Attachments need captured text for reasoning." : "Links and files support the document context."}
                    </div>
                  </div>
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
                  <div className="rounded-2xl border border-neutral-200 bg-neutral-50/50 p-4">
                    <AttachmentPreview
                      attachments={doc.attachments || []}
                      imageCache={imageCache}
                      onPreview={onPreviewFile}
                    />
                  </div>
                </div>
              )}

              {doc.linkedRecordIds && doc.linkedRecordIds.length > 0 && (
                <div className="mt-1 border-t border-neutral-100 pt-1">
                  {renderCompactLinkRow("Linked Case Items", doc.linkedRecordIds, (rid) => {
                    const linkedRecord = getLinkedRecordMeta(rid);
                    if (!linkedRecord) return null;
                    return (
                      <LinkedChip
                        key={rid}
                        onClick={() => onOpenLinkedRecord(rid)}
                        titleText={linkedRecord.title || "Untitled record"}
                        variant="record"
                        className="flex items-center gap-1 text-left transition-colors"
                        leading={<span className="opacity-50 font-bold uppercase">{linkedRecord.typeLabel}</span>}
                      >
                        {linkedRecord.title || "Untitled record"}
                      </LinkedChip>
                    );
                  })}
                </div>
              )}
            </div>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}
