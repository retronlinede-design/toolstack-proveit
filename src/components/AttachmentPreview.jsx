import { useState, useEffect } from "react";

function isImageAttachment(type = "") {
  return type.startsWith("image/");
}

function AttachmentImage({ attachment, alt }) {
  const [imageUrl, setImageUrl] = useState(null);

  useEffect(() => {
    const blob = attachment.file || attachment.blob;
    if (blob) {
      const url = URL.createObjectURL(blob);
      setImageUrl(url);
      return () => {
        URL.revokeObjectURL(url);
      };
    }
  }, [attachment]);

  if (!imageUrl) return null;

  return (
    <img
      src={imageUrl}
      alt={alt}
      className="mb-3 h-32 w-full rounded-xl object-cover border border-neutral-200 bg-neutral-100"
    />
  );
}

export default function AttachmentPreview({ attachments = [] }) {
  if (!attachments.length) return null;

  return (
    <div className="mt-3 space-y-3">
      <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">Attachments</div>
      <div className="grid gap-3 sm:grid-cols-2">
        {attachments.map((file) => {
          const type = file.type || file.mimeType;
          const name = file.name || file.fileName;

          return (
            <div key={file.id} className="rounded-2xl border border-neutral-200 bg-white p-3">
              {isImageAttachment(type) ? (
                <AttachmentImage attachment={file} alt={name} />
              ) : (
                <div className="mb-3 flex h-32 items-center justify-center rounded-xl border border-dashed border-neutral-300 bg-neutral-50 text-sm text-neutral-500">
                  PDF / Document
                </div>
              )}
              <div className="truncate text-sm font-medium text-neutral-800">{name}</div>
              <div className="mt-1 text-xs text-neutral-500">{type || "Unknown type"}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
