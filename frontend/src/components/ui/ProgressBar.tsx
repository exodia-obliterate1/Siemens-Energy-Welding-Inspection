export function ProgressBar({
  progress,
  label,
}: {
  progress: number;
  label?: string;
}) {
  return (
    <div className="w-full">
      {label && (
        <div className="flex justify-between text-sm mb-2">
          <span className="text-[var(--text-secondary)]">{label}</span>
          <span className="text-[var(--accent)] font-mono font-medium">
            {Math.round(progress)}%
          </span>
        </div>
      )}
      <div className="w-full h-1.5 bg-[var(--bg-primary)] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500 ease-out relative"
          style={{
            width: `${progress}%`,
            background: "linear-gradient(90deg, var(--accent), var(--accent-light))",
            boxShadow: "0 0 12px var(--accent-glow-strong)",
          }}
        />
      </div>
    </div>
  );
}
