import React from "react";

interface Row {
  name: string;
  value: number | string;
  color: string;
}

export function ChartTooltip({ label, rows }: { label?: string; rows: Row[] }) {
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2 shadow-card">
      {label && <div className="mb-1 text-xs font-semibold text-ink">{label}</div>}
      <div className="space-y-1">
        {rows.map((r) => (
          <div key={r.name} className="flex items-center gap-2 text-xs text-ink-muted">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: r.color }} />
            <span>{r.name}</span>
            <span className="ml-auto font-semibold text-ink">{r.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
