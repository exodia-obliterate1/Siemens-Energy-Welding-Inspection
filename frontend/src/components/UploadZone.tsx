import { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import {
  Upload, X, Play, Image as ImageIcon, CloudUpload, Sparkles,
} from "lucide-react";

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
      {/* Drop zone */}
      <div
        {...getRootProps()}
        className={`relative rounded-2xl border-2 border-dashed cursor-pointer transition-all duration-300 overflow-hidden ${
          isDragActive
            ? "border-[var(--accent)] bg-[var(--accent)]/5"
            : "border-[var(--border-hover)] hover:border-[var(--accent)]/40 hover:bg-white/[0.01]"
        } ${isProcessing ? "opacity-50 pointer-events-none" : ""} ${
          files.length > 0 ? "p-6" : "p-10"
        }`}
      >
        <input {...getInputProps()} />

        {isDragActive && (
          <div className="absolute inset-0 bg-[var(--accent)]/5 flex items-center justify-center z-10">
            <div className="text-center animate-fade-in">
              <CloudUpload size={48} className="mx-auto mb-3 text-[var(--accent)] animate-float" />
              <p className="text-lg font-semibold text-[var(--accent)]">Drop images here</p>
            </div>
          </div>
        )}

        <div className={`text-center ${isDragActive ? "opacity-0" : ""}`}>
          <div className="inline-flex p-4 rounded-2xl bg-[var(--accent)]/5 mb-4">
            <Upload size={28} className="text-[var(--accent)]" />
          </div>
          <p className="text-[var(--text-secondary)] font-medium">
            Drag & drop weld images here, or{" "}
            <span className="text-[var(--accent)]">browse files</span>
          </p>
          <p className="text-xs text-[var(--text-muted)] mt-2">
            JPG, PNG, WebP — Max 10 MB each
          </p>
        </div>
      </div>

      {/* File list */}
      {files.length > 0 && (
        <div className="animate-fade-in space-y-3">
          <div className="glass rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ImageIcon size={14} className="text-[var(--accent)]" />
                <span className="text-sm font-medium text-[var(--text-secondary)]">
                  {files.length} image{files.length > 1 ? "s" : ""} staged
                </span>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); onFilesChange([]); }}
                className="text-xs text-[var(--text-muted)] hover:text-[var(--danger)] transition-colors px-2 py-1 rounded-md hover:bg-[var(--danger)]/10"
              >
                Clear all
              </button>
            </div>
            <div className="max-h-44 overflow-y-auto divide-y divide-[var(--border)]">
              {files.map((f, i) => (
                <div
                  key={`${f.name}-${i}`}
                  className="px-4 py-2.5 flex items-center justify-between text-sm hover:bg-white/[0.02] transition-colors"
                >
                  <span className="text-[var(--text-secondary)] truncate flex-1 mr-4">
                    {f.name}
                  </span>
                  <span className="text-xs text-[var(--text-muted)] mr-3 font-mono">
                    {(f.size / 1024 / 1024).toFixed(1)} MB
                  </span>
                  <button
                    onClick={(e) => { e.stopPropagation(); removeFile(i); }}
                    className="p-1 rounded-md text-[var(--text-muted)] hover:text-[var(--danger)] hover:bg-[var(--danger)]/10 transition-colors"
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
            className="btn-primary w-full py-3.5 rounded-xl text-sm flex items-center justify-center gap-2"
          >
            {isProcessing ? (
              <>
                <Sparkles size={16} className="animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Play size={16} />
                Run Inspection
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
