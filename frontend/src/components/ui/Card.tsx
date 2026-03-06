import type { ReactNode } from "react";

export function Card({
  children,
  className = "",
  glow = false,
}: {
  children: ReactNode;
  className?: string;
  glow?: boolean;
}) {
  return (
    <div
      className={`glass rounded-2xl p-5 transition-all duration-300 hover:border-[var(--border-hover)] ${
        glow ? "animate-border-glow" : ""
      } ${className}`}
    >
      {children}
    </div>
  );
}
