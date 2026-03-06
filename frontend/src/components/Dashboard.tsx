import { useState, useEffect } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie,
} from "recharts";
import {
  Search, Filter, ShieldAlert, Bug, TrendingUp,
  Image as ImageIcon, ScanLine, BarChart3,
} from "lucide-react";
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
      <div className="text-center py-20 animate-fade-in">
        <div className="inline-flex p-5 rounded-2xl bg-[var(--accent)]/5 mb-5">
          <ScanLine size={40} className="text-[var(--accent)] opacity-50" />
        </div>
        <h3 className="text-lg font-semibold text-[var(--text-secondary)] mb-2">
          No Inspection Data Yet
        </h3>
        <p className="text-sm text-[var(--text-muted)] max-w-sm mx-auto">
          Upload weld images above and run an inspection to see analytics and detection results here.
        </p>
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
  const barData = Object.entries(defectMap)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
  const pieData = barData.map((d) => ({
    ...d,
    fill: DEFECT_COLORS[d.name] || "#8b8fa3",
  }));

  return (
    <div className="space-y-5">
      {/* Header row */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-1 h-6 rounded-full bg-[var(--accent)]" />
          <div>
            <h2 className="text-base font-bold">Analytics Dashboard</h2>
            <p className="text-xs text-[var(--text-muted)]">{items.length} inspections</p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:flex-none">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder="Search images..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full md:w-52 pl-9 pr-3 py-2 glass rounded-xl text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]/40 transition-colors"
            />
          </div>
          <div className="relative">
            <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <select
              value={defectFilter}
              onChange={(e) => setDefectFilter(e.target.value)}
              className="pl-9 pr-8 py-2 glass rounded-xl text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]/40 transition-colors appearance-none cursor-pointer"
            >
              <option value="All">All Defects</option>
              {Object.values(DEFECT_CLASSES).map((cls) => (
                <option key={cls} value={cls}>{cls}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard title="Inspected" value={items.length} icon={<ImageIcon size={18} />} color="var(--accent)" />
        <KpiCard title="Total Defects" value={totalDefects} icon={<Bug size={18} />} color="var(--danger)" />
        <KpiCard title="Avg Severity" value={avgSeverity.toFixed(1)} icon={<TrendingUp size={18} />} color="var(--warning)" />
        <KpiCard title="Defect Types" value={Object.keys(defectMap).length} icon={<ShieldAlert size={18} />} color="#a78bfa" />
      </div>

      {/* Charts */}
      {barData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-3">
          <Card>
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 size={14} className="text-[var(--text-muted)]" />
              <h3 className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
                Defect Type Distribution
              </h3>
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={barData}>
                <XAxis
                  dataKey="name"
                  tick={{ fill: "#4a4e62", fontSize: 10 }}
                  angle={-20}
                  textAnchor="end"
                  height={55}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis tick={{ fill: "#4a4e62", fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    background: "rgba(17, 20, 30, 0.95)",
                    border: "1px solid rgba(255,255,255,0.06)",
                    borderRadius: 12,
                    boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
                  }}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {barData.map((entry) => (
                    <Cell key={entry.name} fill={DEFECT_COLORS[entry.name] || "var(--accent)"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <Card>
            <h3 className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)] mb-4">
              Proportion
            </h3>
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="count"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={85}
                  innerRadius={55}
                  strokeWidth={0}
                >
                  {pieData.map((entry) => (
                    <Cell key={entry.name} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "rgba(17, 20, 30, 0.95)",
                    border: "1px solid rgba(255,255,255,0.06)",
                    borderRadius: 12,
                    boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </div>
      )}

      {/* History table */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
            Inspection History
          </h3>
          <a
            href={getExportCsvUrl(search, defectFilter)}
            className="text-xs text-[var(--accent)] hover:text-[var(--accent-light)] transition-colors font-medium"
          >
            Export CSV
          </a>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th className="text-left py-2.5 pr-4 text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">Image</th>
                <th className="text-left py-2.5 pr-4 text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">Defects</th>
                <th className="text-left py-2.5 pr-4 text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">Count</th>
                <th className="text-left py-2.5 text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">Time</th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-[var(--border)]/30 hover:bg-white/[0.02] cursor-pointer transition-colors"
                  onClick={() => setSelectedResult(r)}
                >
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-3">
                      {r.has_annotated_image && (
                        <img
                          src={getAnnotatedImageUrl(r.image_name)}
                          alt=""
                          className="w-9 h-9 rounded-lg object-cover border border-[var(--border)]"
                        />
                      )}
                      <span className="truncate max-w-[180px] text-[var(--text-secondary)]">{r.image_name}</span>
                    </div>
                  </td>
                  <td className="py-3 pr-4">
                    <div className="flex flex-wrap gap-1">
                      {r.defect_classes
                        ? r.defect_classes.split(", ").map((cls) => (
                            <Badge key={cls} label={cls} color={DEFECT_COLORS[cls] || "var(--accent)"} />
                          ))
                        : <span className="text-[var(--success)] text-xs font-medium">Clean</span>}
                    </div>
                  </td>
                  <td className="py-3 pr-4 font-mono font-medium text-[var(--text-secondary)]">{r.total_defects}</td>
                  <td className="py-3 text-[var(--text-muted)] text-xs">{r.timestamp}</td>
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
