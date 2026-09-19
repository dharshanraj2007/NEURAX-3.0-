import { Card } from "../components/Card";
import { StatTile } from "../components/StatTile";
import { Badge } from "../components/Badge";
import { PageHeader } from "../components/PageHeader";
import { useAgentFeed } from "../hooks/useAgentFeed";
import type { AgentEvent } from "../api/types";
import { formatINR } from "../utils/currency";

function timeAgo(ts: number): string {
  const seconds = Math.max(0, Math.round(Date.now() / 1000 - ts));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.round(minutes / 60)}h ago`;
}

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${Math.round(seconds % 60)}s`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

export function Agent() {
  const { events, status } = useAgentFeed();

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-8">
      <PageHeader
        eyebrow="InspectIQ / Automation"
        title="Autonomous Process Agent"
        description="Runs continuously in the backend with no user interaction and no external AI service - it replays the real 605,620-batch Model-3 history through a cursor, checks every newly-arrived real batch against the same 3-sigma control limits /api/process/drift uses, and tracks a rolling structural-pressure score with the same formula /api/process/bottleneck uses. It only decides when to raise an existing, already-audited real signal - it never invents a number."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Status"
          value={status?.running ? "Running" : "Starting..."}
          tone={status?.running ? "good" : "neutral"}
          hint={status ? `${formatUptime(status.uptime_seconds)} uptime` : undefined}
        />
        <StatTile
          label="Real batches monitored"
          value={status ? status.cursor_batch_id.toLocaleString() : "..."}
          unit={status ? `/ ${status.total_batches.toLocaleString()}` : undefined}
          hint={status ? `${status.batch_step} batches/tick, every ${status.tick_seconds}s` : undefined}
        />
        <StatTile label="Ticks run" value={status ? status.tick_count.toLocaleString() : "..."} />
        <StatTile
          label="Events raised"
          value={status ? status.n_events.toLocaleString() : "..."}
          tone={status && status.counts_by_severity.critical ? "critical" : "warning"}
          hint={
            status
              ? Object.entries(status.counts_by_severity)
                  .map(([k, v]) => `${v} ${k}`)
                  .join(" - ")
              : undefined
          }
        />
      </div>

      <Card
        title="Live agent activity"
        subtitle="Newest first - polling the real backend event log every 3s"
        action={
          <span className="flex items-center gap-1.5 text-xs text-[var(--status-good)]">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--status-good)]" />
            LIVE
          </span>
        }
      >
        {events.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">
            Watching the real batch stream - the agent raises an event only when a real control limit is breached
            or the rolling bottleneck changes, so this may take a few ticks to fill on a fresh start.
          </p>
        ) : (
          <div className="space-y-2">
            {events.map((e) => (
              <AgentEventRow key={e.id} event={e} />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function AgentEventRow({ event }: { event: AgentEvent }) {
  const tone = event.severity === "critical" ? "critical" : "warning";
  const borderColor = event.severity === "critical" ? "var(--status-critical)" : "var(--status-warning)";
  return (
    <div
      className="rounded-md border-l-2 bg-[var(--surface-2)] px-4 py-3"
      style={{ borderLeftColor: borderColor }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge tone={tone}>{event.kind === "drift" ? "Drift" : "Bottleneck"}</Badge>
          <p className="text-sm font-medium text-[var(--text-primary)]">{event.title}</p>
        </div>
        <span className="text-xs text-[var(--text-muted)]">{timeAgo(event.ts)}</span>
      </div>
      <p className="mt-1.5 text-xs text-[var(--text-secondary)]">{event.detail}</p>
      <ul className="mt-2 space-y-0.5 text-xs text-[var(--text-muted)]">
        {event.evidence.map((line, i) => (
          <li key={i}>- {line}</li>
        ))}
      </ul>
      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
        {event.dollar_impact_per_day !== null && (
          <span className="text-[var(--status-good)]">
            Est. +{formatINR(event.dollar_impact_per_day)}/day if relieved (default cost assumptions)
          </span>
        )}
        <a href={event.source_endpoint} className="text-[var(--series-1)] hover:underline" target="_blank" rel="noreferrer">
          {event.source_endpoint}
        </a>
      </div>
      {event.caveat && <p className="mt-2 text-xs italic text-[var(--text-muted)]">{event.caveat}</p>}
    </div>
  );
}
