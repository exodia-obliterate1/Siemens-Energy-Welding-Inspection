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
        <div className="flex justify-between text-sm mb-1">
          <span className="text-[var(--text-secondary)]">{label}</span>
          <span className="text-[var(--accent)] font-mono">{Math.round(progress)}%</span>
        </div>
      )}
      <div className="w-full h-2 bg-[var(--border)] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300 ease-out"
          style={{
            width: `${progress}%`,
            background: "linear-gradient(90deg, var(--accent), var(--accent-light))",
          }}
        />
      </div>
    </div>
  );
}
