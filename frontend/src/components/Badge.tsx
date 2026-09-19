export function Badge({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "good" | "warning" | "serious" | "critical";
  children: React.ReactNode;
}) {
  const styles: Record<string, string> = {
    neutral: "bg-white/10 text-[var(--text-secondary)]",
    good: "bg-[color-mix(in_oklab,var(--status-good)_20%,transparent)] text-[var(--status-good)]",
    warning: "bg-[color-mix(in_oklab,var(--status-warning)_20%,transparent)] text-[var(--status-warning)]",
    serious: "bg-[color-mix(in_oklab,var(--status-serious)_20%,transparent)] text-[var(--status-serious)]",
    critical: "bg-[color-mix(in_oklab,var(--status-critical)_20%,transparent)] text-[var(--status-critical)]",
  };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${styles[tone]}`}>
      {children}
    </span>
  );
}
