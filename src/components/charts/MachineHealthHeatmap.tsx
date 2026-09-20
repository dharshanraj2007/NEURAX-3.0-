import React from "react";
import { useNavigate } from "react-router-dom";
import type { HeatmapCell } from "@/types";
import type { HeatmapRow } from "@/context/AppDataContext";

const SEVERITY_COLOR: Record<HeatmapCell["severity"], string> = {
  normal: "#e3e6d6",
  warning: "#c9700a",
  critical: "#d1291d",
};

const SEVERITY_LABEL: Record<HeatmapCell["severity"], string> = {
  normal: "Normal",
  warning: "Warning",
  critical: "Critical",
};

export function MachineHealthHeatmap({
  hours,
  rows,
  machineName,
}: {
  hours: string[];
  rows: HeatmapRow[];
  machineName: (machineId: string) => string;
}) {
  const navigate = useNavigate();

  return (
    <div className="overflow-x-auto">
      <div className="inline-block min-w-full">
        <div
          className="grid gap-[3px]"
          style={{ gridTemplateColumns: `88px repeat(${hours.length}, minmax(28px, 1fr))` }}
        >
          <div />
          {hours.map((h) => (
            <div key={h} className="pb-1 text-center text-[10px] font-medium text-ink-faint">
              {h}
            </div>
          ))}

          {rows.map((row) => (
            <React.Fragment key={row.machineId}>
              <button
                onClick={() => navigate(`/machine-incidents?machine=${row.machineId}`)}
                className="truncate pr-2 text-right text-xs font-semibold text-ink hover:text-status-info"
                title={machineName(row.machineId)}
              >
                {row.machineId}
              </button>
              {row.cells.map((cell, idx) => (
                <div key={idx} className="group relative">
                  <button
                    onClick={() => navigate(`/machine-incidents?machine=${row.machineId}`)}
                    className="h-6 w-full rounded-[3px] transition-transform hover:scale-[1.15] hover:shadow-card"
                    style={{ backgroundColor: SEVERITY_COLOR[cell.severity] }}
                    aria-label={`${row.machineId} at ${hours[idx]}: ${SEVERITY_LABEL[cell.severity]}`}
                  />
                  <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 hidden -translate-x-1/2 whitespace-nowrap rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs shadow-card group-hover:block">
                    <div className="font-semibold text-ink">{row.machineId} · {hours[idx]}</div>
                    <div className="flex items-center gap-1.5 text-ink-muted">
                      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: SEVERITY_COLOR[cell.severity] }} />
                      {cell.note ?? SEVERITY_LABEL[cell.severity]}
                    </div>
                  </div>
                </div>
              ))}
            </React.Fragment>
          ))}
        </div>

        <div className="mt-3 flex items-center gap-4 text-xs text-ink-muted">
          {(["normal", "warning", "critical"] as const).map((s) => (
            <div key={s} className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-[3px]" style={{ backgroundColor: SEVERITY_COLOR[s] }} />
              {SEVERITY_LABEL[s]}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
