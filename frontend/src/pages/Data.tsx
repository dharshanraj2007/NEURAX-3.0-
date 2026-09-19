import { api } from "../api/client";
import type { DataHealthResponse, DataSource } from "../api/types";
import { Badge } from "../components/Badge";
import { PageHeader } from "../components/PageHeader";
import { ErrorState, LoadingState } from "../components/LoadingState";
import { useApi } from "../hooks/useApi";

const CATEGORY_ORDER = ["Process", "Process (DOE)", "Vision", "Vision model"];

export function DataPage() {
  const health = useApi<DataHealthResponse>(() => api.get("/api/data/health"));

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-8">
      <PageHeader
        eyebrow="InspectIQ / Trust"
        title="Data & Model Status"
        description="What data does this system actually use, and is it real, dataset-ready, model-ready, or calibration-ready right now? Checked live against the actual files on disk, not asserted."
      />

      {health.loading ? (
        <LoadingState />
      ) : health.error ? (
        <ErrorState message={health.error} onRetry={health.reload} />
      ) : (
        <div className="space-y-6">
          {CATEGORY_ORDER.filter((cat) => health.data!.sources.some((s) => s.category === cat)).map((cat) => (
            <div key={cat}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                {cat === "Vision model" ? "Vision pipeline readiness" : cat}
              </p>
              <div className="space-y-2">
                {health
                  .data!.sources.filter((s) => s.category === cat)
                  .map((s) => (
                    <SourceRow key={s.id} source={s} />
                  ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SourceRow({ source: s }: { source: DataSource }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border border-white/10 bg-[var(--surface-1)] p-4">
      <div>
        <p className="text-sm font-semibold text-[var(--text-primary)]">{s.name}</p>
        <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">{s.detail}</p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <Badge tone={s.ready ? "good" : "warning"}>{s.ready ? "READY" : "NOT READY"}</Badge>
        {s.count !== null && (
          <span className="tabular-nums text-xs text-[var(--text-secondary)]">{s.count.toLocaleString()} rows/images</span>
        )}
      </div>
    </div>
  );
}
