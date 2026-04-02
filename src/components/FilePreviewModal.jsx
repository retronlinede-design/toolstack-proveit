import { X, Download, FileText } from "lucide-react";
import { useEffect, useState } from "react";

export default function FilePreviewModal({ file, onClose, imageCache = {} }) {
  const [url, setUrl] = useState(null);
  if (!file) return null;

  const type = file.type || file.mimeType || "";
  const name = file.name || file.fileName || "file";
  const isImage = type.startsWith("image/");
  const isPDF = type === "application/pdf";

  useEffect(() => {
    if (!file) return;

    const imageId = file.storage?.imageId;
    const cached = imageId ? imageCache[imageId] : null;

    if (cached?.dataUrl) {
      setUrl(cached.dataUrl);
      return;
    }

    // fallback for legacy
    if (file.dataUrl) {
      setUrl(file.dataUrl);
      return;
    }
  }, [file]);

  const handleDownload = () => {
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm" onClick={onClose}>
      <button
        onClick={onClose}
        className="absolute right-6 top-6 z-10 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 transition-colors"
      >
        <X className="h-6 w-6" />
      </button>

      <div className="flex h-full w-full max-w-5xl flex-col items-center justify-center gap-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex-1 w-full flex items-center justify-center overflow-hidden">
          {isImage && url && (
            <img src={url} alt={name} className="max-h-full max-w-full rounded-lg object-contain shadow-2xl" />
          )}
          {isPDF && url && (
            <iframe src={url} className="h-full w-full rounded-lg bg-white shadow-2xl" title={name} />
          )}
          {!isImage && !isPDF && (
            <div className="flex flex-col items-center gap-4 rounded-3xl bg-white p-12 text-center shadow-2xl">
              <div className="rounded-full bg-neutral-100 p-6">
                <FileText className="h-12 w-12 text-neutral-400" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-neutral-800">{name}</h3>
                <p className="text-sm text-neutral-500">{type || "Unknown file type"}</p>
              </div>
            </div>
          )}
        </div>

        <div className="flex w-full items-center justify-between rounded-2xl bg-white/10 px-6 py-4 text-white backdrop-blur-md">
          <div className="truncate pr-4">
            <div className="text-sm font-semibold">{name}</div>
            <div className="text-xs opacity-70">{type}</div>
          </div>
          <button
            onClick={handleDownload}
            className="flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-bold text-neutral-900 transition-transform hover:scale-105 active:scale-95"
          >
            <Download className="h-4 w-4" />
            Download
          </button>
        </div>
      </div>
    </div>
  );
}