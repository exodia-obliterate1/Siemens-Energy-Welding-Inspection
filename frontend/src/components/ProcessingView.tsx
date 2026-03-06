import { Shield, ShieldAlert, ShieldX } from "lucide-react";
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
    <Card className="animate-pulse-glow">
      <h2 className="text-lg font-semibold mb-4">Processing Inspection</h2>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_280px] gap-6">
        <div className="bg-[var(--bg-primary)] rounded-lg overflow-hidden min-h-[300px] flex items-center justify-center">
          {currentResult?.has_annotated_image ? (
            <img
              src={getAnnotatedImageUrl(currentResult.image_name)}
              alt={currentResult.image_name}
              className="w-full h-auto object-contain max-h-[400px]"
            />
          ) : currentResult ? (
            <p className="text-[var(--text-muted)]">
              No defects — {currentResult.image_name} is clean
            </p>
          ) : (
            <p className="text-[var(--text-muted)]">Waiting for first image...</p>
          )}
        </div>

        <div className="space-y-4">
          <div className="text-sm text-[var(--text-secondary)]">
            {currentResult && (
              <p className="mb-3 truncate">
                Inspecting: <strong className="text-white">{currentResult.image_name}</strong>
              </p>
            )}
          </div>

          <div className="space-y-3">
            <StatRow icon={<Shield size={16} />} label="Processed" value={processed} total={total} color="var(--accent)" />
            <StatRow icon={<ShieldAlert size={16} />} label="Defective" value={defective} color="var(--danger)" />
            <StatRow icon={<Shield size={16} />} label="Clean" value={clean} color="var(--success)" />
            {skippedCount > 0 && (
              <StatRow icon={<ShieldX size={16} />} label="Skipped" value={skippedCount} color="var(--warning)" />
            )}
          </div>
        </div>
      </div>

      <div className="mt-4">
        <ProgressBar progress={progress} label={`${processed} / ${total} images`} />
      </div>
    </Card>
  );
}

function StatRow({
  icon,
  label,
  value,
  total,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  total?: number;
  color: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
        <span style={{ color }}>{icon}</span>
        {label}
      </div>
      <span className="text-sm font-mono font-medium" style={{ color }}>
        {value}{total !== undefined ? ` / ${total}` : ""}
      </span>
    </div>
  );
}
