import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { Download, ShieldCheck, ShieldAlert, ShieldX, FileStack } from "lucide-react";
import { KpiCard, Card } from "./ui";
import { getExportCsvUrl, getExportZipUrl } from "../lib/api";
import type { InspectionResult, BatchSummary as BatchSummaryType } from "../lib/types";
import { DEFECT_COLORS } from "../lib/types";

export function BatchSummary({
  summary,
  results,
}: {
  summary: BatchSummaryType;
  results: InspectionResult[];
}) {
  const defectMap: Record<string, number> = {};
  for (const r of results) {
    if (!r.defect_classes) continue;
    for (const cls of r.defect_classes.split(", ")) {
      defectMap[cls] = (defectMap[cls] || 0) + 1;
    }
  }
  const chartData = Object.entries(defectMap)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  return (
    <div className="space-y-5 animate-fade-in-up">
      <div className="flex items-center gap-3">
        <div className="w-1 h-6 rounded-full bg-[var(--accent)]" />
        <h2 className="text-base font-bold">Batch Results</h2>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard title="Processed" value={summary.total} icon={<FileStack size={18} />} color="var(--accent)" />
        <KpiCard title="Defective" value={summary.defective} icon={<ShieldAlert size={18} />} color="var(--danger)" />
        <KpiCard title="Clean" value={summary.clean} icon={<ShieldCheck size={18} />} color="var(--success)" />
        <KpiCard title="Skipped" value={summary.skipped} icon={<ShieldX size={18} />} color="var(--warning)" />
      </div>

      {chartData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_240px] gap-3">
          <Card>
            <h3 className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)] mb-4">
              Defect Distribution
            </h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData} layout="vertical" margin={{ left: 10 }}>
                <XAxis type="number" tick={{ fill: "#4a4e62", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fill: "#8b8fa3", fontSize: 11 }} width={120} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    background: "rgba(17, 20, 30, 0.95)",
                    border: "1px solid rgba(255,255,255,0.06)",
                    borderRadius: 12,
                    boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
                  }}
                  labelStyle={{ color: "#e8eaf0" }}
                />
                <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                  {chartData.map((entry) => (
                    <Cell key={entry.name} fill={DEFECT_COLORS[entry.name] || "var(--accent)"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <div className="space-y-3">
            <a
              href={getExportZipUrl()}
              className="glass flex items-center justify-center gap-2 w-full py-3.5 rounded-xl text-sm font-medium hover:border-[var(--accent)]/40 transition-all group"
            >
              <Download size={15} className="text-[var(--accent)] group-hover:scale-110 transition-transform" />
              Annotated Images (ZIP)
            </a>
            <a
              href={getExportCsvUrl()}
              className="glass flex items-center justify-center gap-2 w-full py-3.5 rounded-xl text-sm font-medium hover:border-[var(--accent)]/40 transition-all group"
            >
              <Download size={15} className="text-[var(--accent)] group-hover:scale-110 transition-transform" />
              Inspection Report (CSV)
            </a>
          </div>
        </div>
      )}

      {summary.skipped_files.length > 0 && (
        <Card>
          <h3 className="text-xs font-medium uppercase tracking-wider text-[var(--warning)] mb-3">
            Skipped Files ({summary.skipped_files.length})
          </h3>
          <div className="space-y-1.5 text-sm">
            {summary.skipped_files.map((sf, i) => (
              <p key={i} className="text-[var(--text-secondary)]">
                <span className="text-[var(--text-primary)] font-medium">{sf.name}</span>
                <span className="text-[var(--text-muted)]"> — {sf.reason}</span>
              </p>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
