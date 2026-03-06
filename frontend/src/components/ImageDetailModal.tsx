import { X } from "lucide-react";
import { Badge } from "./ui";
import { getAnnotatedImageUrl } from "../lib/api";
import type { InspectionResult } from "../lib/types";
import { DEFECT_COLORS } from "../lib/types";

export function ImageDetailModal({
  result,
  onClose,
}: {
  result: InspectionResult;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="glass-strong rounded-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto shadow-2xl shadow-black/50 animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-[var(--border)]">
          <div>
            <h3 className="font-bold">{result.image_name}</h3>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">{result.timestamp}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-lg transition-colors">
            <X size={18} className="text-[var(--text-secondary)]" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_280px]">
          <div className="p-4 bg-[var(--bg-primary)] flex items-center justify-center min-h-[400px]">
            {result.has_annotated_image ? (
              <img
                src={getAnnotatedImageUrl(result.image_name)}
                alt={result.image_name}
                className="max-w-full max-h-[70vh] object-contain"
              />
            ) : (
              <p className="text-[var(--text-muted)]">No annotated image available</p>
            )}
          </div>

          <div className="p-5 border-l border-[var(--border)]">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
                Defects Found
              </h4>
              <span className="text-lg font-bold text-[var(--accent)]">
                {result.total_defects}
              </span>
            </div>

            {result.defects.length > 0 ? (
              <div className="space-y-2">
                {result.defects.map((d, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-[var(--bg-primary)]/50 text-sm"
                  >
                    <Badge label={d.class_name} color={DEFECT_COLORS[d.class_name] || "var(--accent)"} />
                    <span className="text-[var(--text-muted)] font-mono text-xs">
                      {(d.confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-sm text-[var(--success)]">No defects detected</p>
                <p className="text-xs text-[var(--text-muted)] mt-1">Clean weld</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
