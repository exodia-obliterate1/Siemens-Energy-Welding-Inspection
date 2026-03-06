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
    <div className="fixed inset-0 z-[70] bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto shadow-2xl animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
          <div>
            <h3 className="font-semibold">{result.image_name}</h3>
            <p className="text-xs text-[var(--text-muted)]">{result.timestamp}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-[var(--border)] rounded-lg transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_300px]">
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

          <div className="p-4 border-l border-[var(--border)]">
            <h4 className="text-sm font-medium text-[var(--text-secondary)] mb-3">
              Defects Found: {result.total_defects}
            </h4>

            {result.defects.length > 0 ? (
              <div className="space-y-2">
                {result.defects.map((d, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-2 rounded-lg bg-[var(--bg-primary)] text-sm"
                  >
                    <Badge label={d.class_name} color={DEFECT_COLORS[d.class_name] || "var(--accent)"} />
                    <span className="text-[var(--text-muted)] font-mono">
                      {(d.confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[var(--success)]">No defects detected — clean weld</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
