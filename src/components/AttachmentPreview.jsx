import { useState, useEffect } from "react";
import { Eye } from "lucide-react";

function isImageAttachment(type = "") {
  return type.startsWith("image/");
}

function AttachmentImage({ attachment, alt, onClick, imageCache = {} }) {
  const [imageUrl, setImageUrl] = useState(null);

  useEffect(() => {
    if (!attachment) return;

    const imageId = attachment.storage?.imageId;
    const cached = imageId ? imageCache[imageId] : null;

    if (cached?.dataUrl) {
      setImageUrl(cached.dataUrl);
      return;
    }

    // legacy fallback for older attachments
    if (attachment.dataUrl) {
      setImageUrl(attachment.dataUrl);
      return;
    }

    setImageUrl(null);
  }, [attachment, imageCache]);

  if (!imageUrl) return null;

  return (
    <img
      src={imageUrl}
      alt={alt}
      onClick={onClick}
      className="mb-3 h-32 w-full rounded-xl object-cover border border-neutral-200 bg-neutral-100 cursor-pointer hover:opacity-90 transition-opacity"
    />
  );
}

export default function AttachmentPreview({ attachments = [], onPreview, imageCache = {} }) {
  if (!attachments.length) return null;

  return (
    <div className="mt-3 space-y-3">
      <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">Attachments</div>
      <div className="grid gap-3 sm:grid-cols-2">
        {attachments.map((file, idx) => {
          const type = file.type || file.mimeType;
          const name = file.name || file.fileName;
          const isEml = type === "message/rfc822" || name?.toLowerCase().endsWith(".eml");
          const meta = file.emailMeta;

          return (
            <div key={file.id || idx} className="rounded-2xl border border-neutral-200 bg-white p-3 flex flex-col">
              {isImageAttachment(type) ? (
                <AttachmentImage attachment={file} alt={name} onClick={() => onPreview?.(file)} imageCache={imageCache} />
              ) : (
                <div 
                  onClick={() => onPreview?.(file)}
                  className="mb-3 flex h-32 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-neutral-300 bg-neutral-50 px-2 text-center text-sm text-neutral-500 hover:bg-neutral-100 transition-colors"
                >
                  <div className="text-[10px] font-bold uppercase text-neutral-400 mb-1">
                    {isEml ? "EML / Email file" : "PDF / Document"}
                  </div>
                  {isEml && meta && (
                    <div className="w-full space-y-0.5 overflow-hidden">
                      {meta.subject && <div className="truncate text-xs font-semibold text-neutral-700">{meta.subject}</div>}
                      {meta.from && <div className="truncate text-[10px] text-neutral-500">{meta.from}</div>}
                      {meta.date && <div className="truncate text-[10px] text-neutral-400">{meta.date}</div>}
                    </div>
                  )}
                </div>
              )}
              <div className="truncate text-sm font-medium text-neutral-800">{name}</div>
              <div className="mt-1 flex items-center justify-between gap-2">
                <div className="truncate text-xs text-neutral-500">{type || "Unknown type"}</div>
                <button
                  onClick={() => onPreview?.(file)}
                  className="flex items-center gap-1 rounded-lg border border-lime-500 bg-white px-2 py-1 text-[10px] font-bold text-neutral-700 shadow-sm hover:bg-lime-50 transition-colors"
                >
                  <Eye className="h-3 w-3" />
                  Preview
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
