import { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, X, Play, Image as ImageIcon } from "lucide-react";

const ACCEPT = {
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/webp": [".webp"],
};

export function UploadZone({
  files,
  onFilesChange,
  onRun,
  isProcessing,
}: {
  files: File[];
  onFilesChange: (files: File[]) => void;
  onRun: () => void;
  isProcessing: boolean;
}) {
  const onDrop = useCallback(
    (accepted: File[]) => {
      onFilesChange([...files, ...accepted]);
    },
    [files, onFilesChange]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPT,
    disabled: isProcessing,
  });

  const removeFile = (index: number) => {
    onFilesChange(files.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200 ${
          isDragActive
            ? "border-[var(--accent)] bg-[var(--accent)]/5"
            : "border-[var(--border)] hover:border-[var(--border-hover)] hover:bg-[var(--bg-card)]"
        } ${isProcessing ? "opacity-50 pointer-events-none" : ""}`}
      >
        <input {...getInputProps()} />
        <Upload size={40} className="mx-auto mb-3 text-[var(--text-muted)]" />
        <p className="text-[var(--text-secondary)]">
          {isDragActive
            ? "Drop images here..."
            : "Drag & drop weld images here, or click to browse"}
        </p>
        <p className="text-xs text-[var(--text-muted)] mt-1">
          JPG, PNG, WebP — Max 10 MB each
        </p>
      </div>

      {files.length > 0 && (
        <>
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between">
              <span className="text-sm text-[var(--text-secondary)]">
                <ImageIcon size={14} className="inline mr-1.5 -mt-0.5" />
                {files.length} image{files.length > 1 ? "s" : ""} staged
              </span>
              <button
                onClick={() => onFilesChange([])}
                className="text-xs text-[var(--text-muted)] hover:text-[var(--danger)] transition-colors"
              >
                Clear all
              </button>
            </div>
            <div className="max-h-48 overflow-y-auto divide-y divide-[var(--border)]">
              {files.map((f, i) => (
                <div
                  key={`${f.name}-${i}`}
                  className="px-4 py-2 flex items-center justify-between text-sm hover:bg-[var(--bg-card-hover)] transition-colors"
                >
                  <span className="text-[var(--text-secondary)] truncate flex-1 mr-4">
                    {f.name}
                  </span>
                  <span className="text-xs text-[var(--text-muted)] mr-3">
                    {(f.size / 1024 / 1024).toFixed(1)} MB
                  </span>
                  <button
                    onClick={() => removeFile(i)}
                    className="text-[var(--text-muted)] hover:text-[var(--danger)] transition-colors"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={onRun}
            disabled={isProcessing}
            className="w-full py-3 rounded-xl font-medium text-white transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50"
            style={{
              background: "linear-gradient(135deg, var(--accent), var(--accent-light))",
            }}
          >
            <Play size={18} />
            {isProcessing ? "Processing..." : "Run Inspection"}
          </button>
        </>
      )}
    </div>
  );
}
