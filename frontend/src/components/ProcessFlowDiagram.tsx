import { Link } from "react-router-dom";
import type { ProcessStage, SharedResource } from "../api/types";
import { Badge } from "./Badge";

const STATUS_COLOR: Record<string, string> = {
  normal: "var(--status-good)",
  watch: "var(--status-warning)",
  constraint: "var(--status-critical)",
};

function stageStatus(stage: ProcessStage): "normal" | "watch" | "constraint" {
  if (stage.resources.some((r) => r.status === "constraint")) return "constraint";
  if (stage.resources.some((r) => r.status === "watch")) return "watch";
  return "normal";
}

export function ProcessFlowDiagram({
  stages,
  sharedResources,
}: {
  stages: ProcessStage[];
  sharedResources: SharedResource[];
}) {
  return (
    <div>
      <div className="flex items-stretch gap-1 overflow-x-auto pb-2">
        <SourceNode />
        {stages.map((stage, i) => (
          <div key={stage.stage} className="flex items-stretch">
            <Arrow />
            <StageCard stage={stage} />
            {i === stages.length - 1 && (
              <>
                <Arrow />
                <SinkNode />
              </>
            )}
          </div>
        ))}
      </div>

      {sharedResources.length > 0 && (
        <div className="mt-6">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
            Shared resources (cross-stage)
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {sharedResources.map((r) => (
              <Link
                key={r.id}
                to={`/production-flow?station=${r.id}`}
                className="rounded-lg border px-4 py-3 transition-transform hover:-translate-y-0.5"
                style={{
                  borderColor: `color-mix(in oklab, ${STATUS_COLOR[r.status]} 45%, transparent)`,
                  background: `color-mix(in oklab, ${STATUS_COLOR[r.status]} 8%, var(--surface-1))`,
                }}
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-[var(--text-primary)]">{r.label}</p>
                  <Badge tone={r.status === "constraint" ? "critical" : r.status === "watch" ? "warning" : "good"}>
                    {r.status === "constraint" ? "constraint" : r.status === "watch" ? "watch" : "normal"}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-[var(--text-muted)]">{r.role}</p>
                <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                  <MiniStat label="Utilization" value={`${(r.mean_utilization * 100).toFixed(0)}%`} />
                  <MiniStat label="Queue" value={r.mean_queue.toFixed(0)} />
                  <MiniStat label="Pressure" value={r.pressure_score.toFixed(2)} />
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StageCard({ stage }: { stage: ProcessStage }) {
  const status = stageStatus(stage);
  return (
    <div
      className="flex w-40 shrink-0 flex-col rounded-lg border px-2.5 py-2.5"
      style={{
        borderColor: `color-mix(in oklab, ${STATUS_COLOR[status]} 40%, transparent)`,
        background: `color-mix(in oklab, ${STATUS_COLOR[status]} 6%, var(--surface-1))`,
      }}
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-[var(--text-primary)]">{stage.stage}</p>
        <span className="h-2 w-2 rounded-full" style={{ background: STATUS_COLOR[status] }} />
      </div>
      <div className="mt-2 space-y-1.5">
        {stage.resources.map((r) => (
          <Link key={r.id} to={`/production-flow?station=${r.id}`} className="block text-[11px] hover:opacity-80">
            <div className="flex items-center justify-between text-[var(--text-muted)]">
              <span>{r.label}</span>
              <span className="tabular-nums text-[var(--text-secondary)]">
                {r.mean_utilization !== null ? `${(r.mean_utilization * 100).toFixed(0)}%` : "-"}
              </span>
            </div>
            <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.min(100, (r.mean_utilization ?? 0) * 100)}%`,
                  background: STATUS_COLOR[r.status] ?? "var(--series-1)",
                }}
              />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] text-[var(--text-muted)]">{label}</p>
      <p className="tabular-nums text-[var(--text-primary)]">{value}</p>
    </div>
  );
}

function Arrow() {
  return (
    <div className="flex w-8 shrink-0 items-center justify-center text-[var(--text-muted)]">
      <svg width="20" height="16" viewBox="0 0 20 16" fill="none" stroke="currentColor" strokeWidth="1.6">
        <path d="M1 8h16M13 3l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

function SourceNode() {
  return (
    <div className="flex w-24 shrink-0 flex-col items-center justify-center rounded-lg border border-white/10 bg-[var(--surface-2)] px-2 text-center">
      <p className="text-[11px] font-medium text-[var(--text-secondary)]">Steel Coil</p>
      <p className="text-[10px] text-[var(--text-muted)]">raw material</p>
    </div>
  );
}
function SinkNode() {
  return (
    <div className="flex w-24 shrink-0 flex-col items-center justify-center rounded-lg border border-white/10 bg-[var(--surface-2)] px-2 text-center">
      <p className="text-[11px] font-medium text-[var(--text-secondary)]">Finished Part</p>
      <p className="text-[10px] text-[var(--text-muted)]">post-QC</p>
    </div>
  );
}
