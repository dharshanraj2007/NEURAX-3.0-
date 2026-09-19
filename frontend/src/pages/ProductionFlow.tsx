import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import type { BottleneckReport, DemandResponsePayload, DriftReport, StationsResponse } from "../api/types";
import { Card } from "../components/Card";
import { Badge } from "../components/Badge";
import { ErrorState, LoadingState } from "../components/LoadingState";
import { FocusBanner, useClearFocusParam } from "../components/FocusBanner";
import { PageHeader } from "../components/PageHeader";
import { useApi } from "../hooks/useApi";
import { ProcessFlowDiagram } from "../components/ProcessFlowDiagram";
import { useAppFilters } from "../context/AppFilters";
import {
  Line,
  LineChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend as RLegend,
} from "recharts";

export function ProductionFlow() {
  const { timeWindow } = useAppFilters();
  const [searchParams] = useSearchParams();
  const focusStation = searchParams.get("station");
  const clearFocus = useClearFocusParam(["station"]);
  const stations = useApi<StationsResponse>(() => api.get("/api/process/stations"));
  const bottleneck = useApi<BottleneckReport>(() => api.get("/api/process/bottleneck"));
  const drift = useApi<DriftReport>(() => api.get(`/api/process/drift?window=${timeWindow}&sigma=3`), [timeWindow]);
  const demand = useApi<DemandResponsePayload>(() => api.get("/api/process/demand-response"));
  const [demandSlider, setDemandSlider] = useState(10);

  const focusResource = focusStation
    ? [...(stations.data?.stages.flatMap((s) => s.resources) ?? []), ...(stations.data?.shared_resources ?? [])].find(
        (r) => r.id === focusStation
      )
    : undefined;

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-8">
      <PageHeader
        eyebrow="InspectIQ / Process"
        title="Production Flow"
        description={`Where is the constraint, and how much headroom is left? Steel coil → Blanking → Pressing → Assembly → Paint → QC, measured from all ${bottleneck.data?.n_batches_analyzed.toLocaleString() ?? "605,620"} real batches.`}
      />

      {focusStation && (
        <FocusBanner
          label={
            focusResource && focusResource.mean_utilization !== null
              ? `Station "${focusResource.label}" from Root Cause - ${(focusResource.mean_utilization * 100).toFixed(0)}% utilization`
              : `Station "${focusStation}" from Root Cause`
          }
          onClear={clearFocus}
        />
      )}

      {stations.loading ? (
        <LoadingState />
      ) : stations.error ? (
        <ErrorState message={stations.error} onRetry={stations.reload} />
      ) : (
        <>
          <Card title="Process flow">
            <ProcessFlowDiagram stages={stations.data!.stages} sharedResources={stations.data!.shared_resources} />
          </Card>

          <Card
            title="Resource table"
            subtitle="Ranked by structural pressure score (0.6 x utilization + 0.4 x normalized queue)"
            action={
              focusResource && focusResource.mean_utilization !== null ? (
                <Link
                  to={`/economics?station=${focusResource.id}&target=${(focusResource.mean_utilization * 0.75).toFixed(3)}`}
                  className="rounded-md bg-[var(--series-2)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
                >
                  Simulate relieving {focusResource.label} on Economics &rarr;
                </Link>
              ) : undefined
            }
          >
            <ResourceTable stages={stations.data!.stages} sharedResources={stations.data!.shared_resources} focusStation={focusStation} />
          </Card>

          {bottleneck.data && (
            <Card title="Method & caveats" subtitle="Read before quoting a number from this page">
              <p className="text-sm leading-relaxed text-[var(--text-secondary)]">{bottleneck.data.method}</p>
              <p className="mt-3 rounded-md bg-[var(--status-warning)]/10 p-3 text-xs leading-relaxed text-[var(--status-warning)]">
                {bottleneck.data.caveat}
              </p>
            </Card>
          )}

          {!drift.loading && drift.data && (
            <Card
              title={`Batch drift - ${drift.data.window} most recent batches`}
              subtitle={`${drift.data.n_alerts} control-limit breaches at ${drift.data.sigma}-sigma (window set by the Time Range selector)`}
            >
              {drift.data.n_alerts === 0 ? (
                <p className="text-sm text-[var(--text-muted)]">
                  No drift detected in this window - all stations within historical control limits.
                </p>
              ) : (
                <div className="max-h-72 overflow-y-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="text-xs uppercase text-[var(--text-muted)]">
                      <tr>
                        <th className="pb-2 pr-4">Batch</th>
                        <th className="pb-2 pr-4">Station</th>
                        <th className="pb-2 pr-4">Value</th>
                        <th className="pb-2">Direction</th>
                      </tr>
                    </thead>
                    <tbody className="tabular-nums text-[var(--text-secondary)]">
                      {drift.data.alerts.map((a, i) => (
                        <tr key={i} className="border-t border-white/5">
                          <td className="py-1.5 pr-4">{a.batch_id}</td>
                          <td className="py-1.5 pr-4 text-[var(--text-primary)]">{a.station}</td>
                          <td className="py-1.5 pr-4">{a.value.toFixed(3)}</td>
                          <td className="py-1.5">
                            <Badge tone={a.direction === "above" ? "critical" : "warning"}>{a.direction}</Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}

          <Card
            title="Capacity planning (Model-1 reference line)"
            subtitle="Real Design-of-Experiments fit: Demand -> throughput/utilization/wait-time (Drilling -> Milling -> Assembly)"
          >
            {demand.loading && <LoadingState />}
            {demand.data && (
              <div className="space-y-4">
                <ResponsiveContainer debounce={200} width="100%" height={260}>
                  <LineChart data={buildDemandSeries(demand.data.empirical_curve)}>
                    <CartesianGrid stroke="var(--gridline)" vertical={false} />
                    <XAxis dataKey="demand" tick={{ fill: "var(--text-muted)", fontSize: 11 }} axisLine={{ stroke: "var(--baseline)" }} tickLine={false} />
                    <YAxis tick={{ fill: "var(--text-muted)", fontSize: 11 }} axisLine={{ stroke: "var(--baseline)" }} tickLine={false} />
                    <Tooltip contentStyle={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                    <RLegend wrapperStyle={{ fontSize: 12, color: "var(--text-secondary)" }} />
                    <Line type="monotone" dataKey="Parts/hour" stroke="var(--series-1)" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
                <div className="rounded-md bg-[var(--surface-2)] p-4">
                  <label className="text-xs font-medium text-[var(--text-muted)]">
                    Demand level: <span className="tabular-nums text-[var(--text-primary)]">{demandSlider}</span>
                  </label>
                  <input
                    type="range"
                    min={1}
                    max={20}
                    value={demandSlider}
                    onChange={(e) => setDemandSlider(Number(e.target.value))}
                    className="mt-2 w-full accent-[var(--series-1)]"
                  />
                  <DemandPrediction demand={demandSlider} />
                </div>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

function ResourceTable({
  stages,
  sharedResources,
  focusStation,
}: {
  stages: StationsResponse["stages"];
  sharedResources: StationsResponse["shared_resources"];
  focusStation?: string | null;
}) {
  const rows = [
    ...stages.flatMap((s) => s.resources.map((r) => ({ ...r, stage: s.stage }))),
    ...sharedResources.map((r) => ({ ...r, stage: "Shared", is_pass_through: false })),
  ].sort((a, b) => (b.pressure_score ?? 0) - (a.pressure_score ?? 0));

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="text-xs uppercase text-[var(--text-muted)]">
          <tr>
            <th className="pb-2 pr-4">Resource</th>
            <th className="pb-2 pr-4">Stage</th>
            <th className="pb-2 pr-4">Utilization</th>
            <th className="pb-2 pr-4">Queue</th>
            <th className="pb-2 pr-4">Pressure</th>
            <th className="pb-2">Status</th>
          </tr>
        </thead>
        <tbody className="tabular-nums text-[var(--text-secondary)]">
          {rows.map((r) => (
            <tr
              key={r.id}
              className={`border-t border-white/5 ${r.id === focusStation ? "bg-[var(--series-1)]/10" : ""}`}
            >
              <td className="py-1.5 pr-4 text-[var(--text-primary)]">
                {r.label}
                {r.is_pass_through && <span className="ml-1.5 text-[10px] text-[var(--text-muted)]">(pass-through)</span>}
                {r.id === focusStation && <span className="ml-1.5 text-[10px] text-[var(--series-1)]">(focused)</span>}
              </td>
              <td className="py-1.5 pr-4">{r.stage}</td>
              <td className="py-1.5 pr-4">{r.mean_utilization !== null ? `${(r.mean_utilization * 100).toFixed(1)}%` : "-"}</td>
              <td className="py-1.5 pr-4">{r.mean_queue !== null ? r.mean_queue.toFixed(1) : "-"}</td>
              <td className="py-1.5 pr-4">{r.pressure_score !== null ? r.pressure_score.toFixed(3) : "-"}</td>
              <td className="py-1.5">
                <Badge tone={r.status === "constraint" ? "critical" : r.status === "watch" ? "warning" : "good"}>
                  {r.status.toUpperCase()}
                </Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function buildDemandSeries(curve: DemandResponsePayload["empirical_curve"]) {
  return curve.demand_levels.map((d, i) => ({
    demand: d,
    "Parts/hour": Number(curve.mean_parts_per_hour[i].toFixed(1)),
  }));
}

function DemandPrediction({ demand }: { demand: number }) {
  const pred = useApi<DemandResponsePayload>(() => api.get(`/api/process/demand-response?demand=${demand}`), [demand]);
  if (pred.loading || !pred.data?.prediction_at_demand) return null;
  const p = pred.data.prediction_at_demand;
  return (
    <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
      <MiniStat label="Parts/hour" value={p.parts_per_hour.toFixed(1)} />
      <MiniStat label="Drilling util" value={`${(p.drilling_util * 100).toFixed(0)}%`} />
      <MiniStat label="Milling util" value={`${(p.milling_util * 100).toFixed(0)}%`} />
      <MiniStat label="Assembly wait" value={`${p.assembly_wait.toFixed(2)}h`} />
    </div>
  );
}
function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] text-[var(--text-muted)]">{label}</p>
      <p className="tabular-nums text-sm font-semibold text-[var(--text-primary)]">{value}</p>
    </div>
  );
}
