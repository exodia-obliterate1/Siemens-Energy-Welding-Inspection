export function Badge({
  label,
  color = "var(--accent)",
}: {
  label: string;
  color?: string;
}) {
  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium tracking-wide"
      style={{
        backgroundColor: `${color}15`,
        color,
        border: `1px solid ${color}30`,
      }}
    >
      {label}
    </span>
  );
}
