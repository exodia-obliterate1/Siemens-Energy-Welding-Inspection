import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
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
    <div className="space-y-6 animate-fade-in">
      <h2 className="text-lg font-semibold">Batch Summary</h2>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard title="Total Processed" value={summary.total} icon={<FileStack size={20} />} color="var(--accent)" />
        <KpiCard title="Defective" value={summary.defective} icon={<ShieldAlert size={20} />} color="var(--danger)" />
        <KpiCard title="Clean" value={summary.clean} icon={<ShieldCheck size={20} />} color="var(--success)" />
        <KpiCard title="Skipped" value={summary.skipped} icon={<ShieldX size={20} />} color="var(--warning)" />
      </div>

      {chartData.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-[1fr_280px] gap-4">
          <Card>
            <h3 className="text-sm text-[var(--text-secondary)] mb-4">Defect Distribution</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} layout="vertical" margin={{ left: 20 }}>
                <XAxis type="number" tick={{ fill: "#8b8fa3", fontSize: 12 }} />
                <YAxis type="category" dataKey="name" tick={{ fill: "#8b8fa3", fontSize: 12 }} width={130} />
                <Tooltip
                  contentStyle={{ background: "#1a1d27", border: "1px solid #2a2d3a", borderRadius: 8 }}
                  labelStyle={{ color: "#f0f0f0" }}
                />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
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
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] text-sm hover:border-[var(--accent)] transition-colors"
            >
              <Download size={16} className="text-[var(--accent)]" />
              Download Annotated (ZIP)
            </a>
            <a
              href={getExportCsvUrl()}
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] text-sm hover:border-[var(--accent)] transition-colors"
            >
              <Download size={16} className="text-[var(--accent)]" />
              Download Report (CSV)
            </a>
          </div>
        </div>
      )}

      {summary.skipped_files.length > 0 && (
        <Card>
          <h3 className="text-sm text-[var(--warning)] mb-2">
            Skipped Files ({summary.skipped_files.length})
          </h3>
          <div className="space-y-1 text-sm">
            {summary.skipped_files.map((sf, i) => (
              <p key={i} className="text-[var(--text-secondary)]">
                <strong>{sf.name}</strong> — {sf.reason}
              </p>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
