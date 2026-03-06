import type { ReactNode } from "react";

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-5 transition-all duration-200 hover:border-[var(--border-hover)] ${className}`}
    >
      {children}
    </div>
  );
}
