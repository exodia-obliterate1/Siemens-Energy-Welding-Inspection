import type { ReactNode } from "react";

export function KpiCard({
  title,
  value,
  icon,
  color = "var(--accent)",
}: {
  title: string;
  value: string | number;
  icon: ReactNode;
  color?: string;
}) {
  return (
    <div className="glass rounded-2xl p-5 transition-all duration-300 hover:border-[var(--border-hover)] group animate-fade-in">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
            {title}
          </p>
          <p className="text-3xl font-bold tracking-tight" style={{ color }}>
            {value}
          </p>
        </div>
        <div
          className="p-2.5 rounded-xl transition-transform duration-300 group-hover:scale-110"
          style={{ backgroundColor: `${color}12`, color }}
        >
          {icon}
        </div>
      </div>
      <div
        className="mt-3 h-0.5 rounded-full opacity-40"
        style={{ background: `linear-gradient(90deg, ${color}, transparent)` }}
      />
    </div>
  );
}
