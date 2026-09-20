import React from "react";
import type { Severity } from "@/types";

const SEVERITY_COLOR: Record<Severity, string> = {
  normal: "#c7c2ac",
  warning: "#c9700a",
  critical: "#d1291d",
};

export interface ContributionRow {
  key: string;
  label: string;
  actual: number;
  unit: string;
  severity: Severity;
  contribution: number;
}

/** Horizontal bars showing each parameter's share of a defect's total out-of-range deviation. */
export function FeatureContributionChart({ rows }: { rows: ContributionRow[] }) {
  const sorted = [...rows].sort((a, b) => b.contribution - a.contribution);
  return (
    <div className="space-y-2.5">
      {sorted.map((r) => (
        <div key={r.key} className="flex items-center gap-3">
          <div className="w-32 shrink-0 text-xs font-medium text-ink">{r.label}</div>
          <div className="h-3 flex-1 overflow-hidden rounded-full bg-bg">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${Math.max(r.contribution * 100, 2)}%`, backgroundColor: SEVERITY_COLOR[r.severity] }}
            />
          </div>
          <div className="w-16 shrink-0 text-right text-xs font-semibold tabular-nums text-ink">
            {Math.round(r.contribution * 100)}%
          </div>
        </div>
      ))}
    </div>
  );
}
