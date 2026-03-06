import type { ReactNode } from "react";
import { Card } from "./Card";

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
    <Card className="animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-[var(--text-secondary)]">{title}</p>
          <p className="text-2xl font-bold mt-1" style={{ color }}>
            {value}
          </p>
        </div>
        <div
          className="p-3 rounded-lg"
          style={{ backgroundColor: `${color}15` }}
        >
          {icon}
        </div>
      </div>
    </Card>
  );
}
