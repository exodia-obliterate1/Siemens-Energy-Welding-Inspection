import { Shield, Loader2 } from "lucide-react";
import { Card, ProgressBar } from "./ui";
import { getAnnotatedImageUrl } from "../lib/api";
import type { InspectionResult } from "../lib/types";

export function ProcessingView({
  currentResult,
  processed,
  total,
  defective,
  clean,
  skippedCount,
}: {
  currentResult: InspectionResult | null;
  processed: number;
  total: number;
  defective: number;
  clean: number;
  skippedCount: number;
}) {
  const progress = total > 0 ? (processed / total) * 100 : 0;

  return (
    <Card glow className="animate-fade-in-up">
      <div className="flex items-center gap-3 mb-5">
        <Loader2 size={18} className="text-[var(--accent)] animate-spin" />
        <h2 className="text-base font-bold">Processing Inspection</h2>
        <span className="text-xs font-mono text-[var(--text-muted)] ml-auto">
          {processed}/{total}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-5">
        <div className="bg-[var(--bg-primary)] rounded-xl overflow-hidden min-h-[280px] flex items-center justify-center border border-[var(--border)]">
          {currentResult?.has_annotated_image ? (
            <img
              src={getAnnotatedImageUrl(currentResult.image_name)}
              alt={currentResult.image_name}
              className="w-full h-auto object-contain max-h-[380px]"
            />
          ) : currentResult ? (
            <div className="text-center p-8">
              <Shield size={32} className="mx-auto mb-2 text-[var(--success)] opacity-60" />
              <p className="text-sm text-[var(--text-muted)]">
                No defects — <span className="text-[var(--success)]">{currentResult.image_name}</span> is clean
              </p>
            </div>
          ) : (
            <div className="text-center p-8">
              <Loader2 size={28} className="mx-auto mb-2 text-[var(--text-muted)] animate-spin" />
              <p className="text-sm text-[var(--text-muted)]">Waiting for first image...</p>
            </div>
          )}
        </div>

        <div className="space-y-4">
          {currentResult && (
            <div className="text-sm">
              <p className="text-[var(--text-muted)] text-xs mb-1">Currently inspecting</p>
              <p className="font-medium truncate">{currentResult.image_name}</p>
            </div>
          )}

          <div className="space-y-3 p-3 rounded-xl bg-[var(--bg-primary)]/50">
            <StatRow label="Processed" value={processed} total={total} color="var(--accent)" />
            <StatRow label="Defective" value={defective} color="var(--danger)" />
            <StatRow label="Clean" value={clean} color="var(--success)" />
            {skippedCount > 0 && (
              <StatRow label="Skipped" value={skippedCount} color="var(--warning)" />
            )}
          </div>
        </div>
      </div>

      <div className="mt-5">
        <ProgressBar progress={progress} label={`${processed} / ${total} images`} />
      </div>
    </Card>
  );
}

function StatRow({
  label,
  value,
  total,
  color,
}: {
  label: string;
  value: number;
  total?: number;
  color: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
        {label}
      </div>
      <span className="text-sm font-mono font-semibold" style={{ color }}>
        {value}{total !== undefined ? ` / ${total}` : ""}
      </span>
    </div>
  );
}
