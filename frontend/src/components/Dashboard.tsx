import { useState, useEffect } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie,
} from "recharts";
import { Search, Filter, ShieldAlert, Bug, TrendingUp, Image as ImageIcon } from "lucide-react";
import { KpiCard, Card, Badge } from "./ui";
import { fetchHistory, getAnnotatedImageUrl, getExportCsvUrl } from "../lib/api";
import { ImageDetailModal } from "./ImageDetailModal";
import type { InspectionResult } from "../lib/types";
import { DEFECT_COLORS, DEFECT_CLASSES } from "../lib/types";

export function Dashboard({ refreshKey }: { refreshKey: number }) {
  const [items, setItems] = useState<InspectionResult[]>([]);
  const [search, setSearch] = useState("");
  const [defectFilter, setDefectFilter] = useState("All");
  const [selectedResult, setSelectedResult] = useState<InspectionResult | null>(null);

  useEffect(() => {
    fetchHistory(search, defectFilter).then((res) => setItems(res.items));
  }, [search, defectFilter, refreshKey]);

  if (items.length === 0) {
    return (
      <div className="text-center py-16 text-[var(--text-muted)]">
        <ImageIcon size={48} className="mx-auto mb-4 opacity-40" />
        <p>No inspection data yet. Upload images and run an inspection to see analytics.</p>
      </div>
    );
  }

  const totalDefects = items.reduce((s, r) => s + r.total_defects, 0);
  const avgSeverity = totalDefects / items.length;

  const defectMap: Record<string, number> = {};
  for (const r of items) {
    if (!r.defect_summary) continue;
    for (const chunk of r.defect_summary.split(", ")) {
      const name = chunk.split("(")[0].trim();
      const count = parseInt(chunk.match(/\((\d+)\)/)?.[1] || "1");
      if (name) defectMap[name] = (defectMap[name] || 0) + count;
    }
  }
  const barData = Object.entries(defectMap).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  const pieData = barData.map((d) => ({ ...d, fill: DEFECT_COLORS[d.name] || "#8b8fa3" }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <h2 className="text-lg font-semibold">Analytics Dashboard</h2>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:flex-none">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder="Search image name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full md:w-56 pl-9 pr-3 py-2 bg-[var(--bg-card)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] transition-colors"
            />
          </div>
          <div className="relative">
            <Filter size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <select
              value={defectFilter}
              onChange={(e) => setDefectFilter(e.target.value)}
              className="pl-9 pr-3 py-2 bg-[var(--bg-card)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] transition-colors appearance-none cursor-pointer"
            >
              <option value="All">All Defects</option>
              {Object.values(DEFECT_CLASSES).map((cls) => (
                <option key={cls} value={cls}>{cls}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard title="Inspected Images" value={items.length} icon={<ImageIcon size={20} />} color="var(--accent)" />
        <KpiCard title="Total Defects" value={totalDefects} icon={<Bug size={20} />} color="var(--danger)" />
        <KpiCard title="Avg Severity" value={avgSeverity.toFixed(1)} icon={<TrendingUp size={20} />} color="var(--warning)" />
        <KpiCard title="Defect Types" value={Object.keys(defectMap).length} icon={<ShieldAlert size={20} />} color="#a78bfa" />
      </div>

      {barData.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr] gap-4">
          <Card>
            <h3 className="text-sm text-[var(--text-secondary)] mb-4">Defect Type Distribution</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={barData}>
                <XAxis dataKey="name" tick={{ fill: "#8b8fa3", fontSize: 11 }} angle={-20} textAnchor="end" height={60} />
                <YAxis tick={{ fill: "#8b8fa3", fontSize: 12 }} />
                <Tooltip contentStyle={{ background: "#1a1d27", border: "1px solid #2a2d3a", borderRadius: 8 }} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {barData.map((entry) => (
                    <Cell key={entry.name} fill={DEFECT_COLORS[entry.name] || "var(--accent)"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <Card>
            <h3 className="text-sm text-[var(--text-secondary)] mb-4">Proportion</h3>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="count"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={85}
                  innerRadius={50}
                  strokeWidth={0}
                >
                  {pieData.map((entry) => (
                    <Cell key={entry.name} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: "#1a1d27", border: "1px solid #2a2d3a", borderRadius: 8 }} />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </div>
      )}

      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm text-[var(--text-secondary)]">Inspection History</h3>
          <a
            href={getExportCsvUrl(search, defectFilter)}
            className="text-xs text-[var(--accent)] hover:underline"
          >
            Export CSV
          </a>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-[var(--text-muted)]">
                <th className="text-left py-2 pr-4 font-medium">Image</th>
                <th className="text-left py-2 pr-4 font-medium">Defects</th>
                <th className="text-left py-2 pr-4 font-medium">Count</th>
                <th className="text-left py-2 font-medium">Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-[var(--border)]/50 hover:bg-[var(--bg-card-hover)] cursor-pointer transition-colors"
                  onClick={() => setSelectedResult(r)}
                >
                  <td className="py-2.5 pr-4">
                    <div className="flex items-center gap-2">
                      {r.has_annotated_image && (
                        <img
                          src={getAnnotatedImageUrl(r.image_name)}
                          alt=""
                          className="w-8 h-8 rounded object-cover"
                        />
                      )}
                      <span className="truncate max-w-[200px]">{r.image_name}</span>
                    </div>
                  </td>
                  <td className="py-2.5 pr-4">
                    <div className="flex flex-wrap gap-1">
                      {r.defect_classes
                        ? r.defect_classes.split(", ").map((cls) => (
                            <Badge key={cls} label={cls} color={DEFECT_COLORS[cls] || "var(--accent)"} />
                          ))
                        : <span className="text-[var(--success)] text-xs">Clean</span>}
                    </div>
                  </td>
                  <td className="py-2.5 pr-4 font-mono">{r.total_defects}</td>
                  <td className="py-2.5 text-[var(--text-muted)]">{r.timestamp}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {selectedResult && (
        <ImageDetailModal result={selectedResult} onClose={() => setSelectedResult(null)} />
      )}
    </div>
  );
}
