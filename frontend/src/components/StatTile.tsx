export function StatTile({
  label,
  value,
  unit,
  tone = "neutral",
  hint,
}: {
  label: string;
  value: string;
  unit?: string;
  tone?: "neutral" | "good" | "warning" | "serious" | "critical";
  hint?: string;
}) {
  const toneColor: Record<string, string> = {
    neutral: "var(--text-primary)",
    good: "var(--status-good)",
    warning: "var(--status-warning)",
    serious: "var(--status-serious)",
    critical: "var(--status-critical)",
  };
  return (
    <div className="rounded-lg border border-white/10 bg-[var(--surface-1)] px-5 py-4">
      <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">{label}</p>
      <p className="tabular-nums mt-1.5 text-2xl font-semibold" style={{ color: toneColor[tone] }}>
        {value}
        {unit && <span className="ml-1 text-sm font-normal text-[var(--text-secondary)]">{unit}</span>}
      </p>
      {hint && <p className="mt-1 text-xs text-[var(--text-muted)]">{hint}</p>}
    </div>
  );
}
