import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import type {
  BottleneckReport,
  DriftReport,
  ProfitabilityResult,
  RecommendationsResponse,
  RootCauseReport,
  StationsResponse,
} from "../api/types";
import { Card } from "../components/Card";
import { StatTile } from "../components/StatTile";
import { Badge } from "../components/Badge";
import { PageHeader } from "../components/PageHeader";
import { DecisionChain, type ChainNode } from "../components/DecisionChain";
import { ProvenanceBadge } from "../components/ProvenanceBadge";
import { ErrorState, LoadingState } from "../components/LoadingState";
import { useApi } from "../hooks/useApi";
import { useAgentFeed } from "../hooks/useAgentFeed";
import { formatINR } from "../utils/currency";
import { CLASS_META } from "../constants/defectClasses";
import { LiveBatchTicker } from "../components/LiveBatchTicker";
import { ProcessFlowDiagram } from "../components/ProcessFlowDiagram";

const DEFAULT_ASSUMPTIONS = { unit_price: 45, scrap_cost_per_unit: 18, operating_cost_per_hour: 900 };

export function Overview() {
  const agentFeed = useAgentFeed();
  const bottleneck = useApi<BottleneckReport>(() => api.get("/api/process/bottleneck"));
  const drift = useApi<DriftReport>(() => api.get("/api/process/drift?window=200"));
  const rootCause = useApi<RootCauseReport>(() => api.get("/api/root-cause"));
  const stations = useApi<StationsResponse>(() => api.get("/api/process/stations"));
  const recs = useApi<RecommendationsResponse>(() => api.post("/api/recommendations", DEFAULT_ASSUMPTIONS));
  const [profit, setProfit] = useState<ProfitabilityResult | null>(null);

  useEffect(() => {
    if (!rootCause.data) return;
    api
      .post<ProfitabilityResult>("/api/economics/profitability", DEFAULT_ASSUMPTIONS)
      .then(setProfit)
      .catch(() => void 0);
  }, [rootCause.data]);

  const loading = bottleneck.loading || drift.loading || rootCause.loading;
  const error = bottleneck.error ?? drift.error ?? rootCause.error;

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-8">
      <PageHeader
        eyebrow="InspectIQ / Operations"
        title="Line Overview"
        description="Unified view of product quality, production throughput, the current constraint and profitability - one continuous story, not nine unrelated charts."
        status={
          <span className="flex items-center gap-1.5 text-xs text-[var(--status-good)]">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--status-good)]" />
            Autonomous agent watching live
          </span>
        }
      />

      {loading ? (
        <LoadingState label="Computing bottleneck, drift and root-cause reports from real data (first load only - cached afterwards)..." />
      ) : error ? (
        <ErrorState message={error} onRetry={bottleneck.reload} />
      ) : (
        <OverviewBody
          bottleneck={bottleneck.data!}
          drift={drift.data!}
          rootCause={rootCause.data!}
          stations={stations.data}
          profit={profit}
          recs={recs.data}
          agentFeed={agentFeed}
        />
      )}
    </div>
  );
}

function OverviewBody({
  bottleneck,
  drift,
  rootCause,
  stations,
  profit,
  recs,
  agentFeed,
}: {
  bottleneck: BottleneckReport;
  drift: DriftReport;
  rootCause: RootCauseReport;
  stations: StationsResponse | null;
  profit: ProfitabilityResult | null;
  recs: RecommendationsResponse | null;
  agentFeed: ReturnType<typeof useAgentFeed>;
}) {
  const constraint = bottleneck.ranking.find((r) => r.station === bottleneck.top_station)!;
  const theoreticalMaxOutput =
    constraint.mean_utilization > 0 ? bottleneck.baseline_mean_output_parts_per_day / constraint.mean_utilization : bottleneck.baseline_mean_output_parts_per_day;
  const gap = theoreticalMaxOutput - bottleneck.baseline_mean_output_parts_per_day;

  const topClassEntry = Object.entries(rootCause.class_counts)
    .filter(([k]) => k !== "none" && k !== "inclusion")
    .sort((a, b) => b[1] - a[1])[0];
  const topClass = topClassEntry?.[0];
  const topClassCount = topClassEntry?.[1] ?? 0;
  const topClassDrivers = topClass ? rootCause.top_drivers_by_class[topClass] ?? [] : [];
  const topClassStation = topClassDrivers[0]?.station;
  const topClassAuc = topClass ? rootCause.roc_auc_by_class[topClass] : undefined;
  const topRec = recs?.recommendations[0];

  const chainNodes: ChainNode[] = [
    { label: "Defect", value: topClass ? CLASS_META[topClass]?.label ?? topClass : "-", to: topClass ? `/defects?class=${topClass}` : undefined, provenance: "real" },
    { label: "Process", value: topClassStation ?? "-", to: topClassStation ? `/production-flow?station=${topClassStation}` : undefined, provenance: "derived" },
    { label: "Root Cause", value: "Process-linked driver", to: topClass ? `/root-cause?class=${topClass}` : undefined, provenance: "model" },
    { label: "Constraint", value: bottleneck.top_station, to: `/production-flow?station=${bottleneck.top_station}`, provenance: "derived" },
    { label: "Throughput", value: `${Math.round(bottleneck.baseline_mean_output_parts_per_day).toLocaleString()}/day`, to: "/production-flow", provenance: "real" },
    { label: "Economics", value: profit ? formatINR(profit.profit) + "/day" : "...", to: "/economics", provenance: "assumption" },
    { label: "Recommendation", value: topRec ? topRec.title.replace(/^Relieve pressure at /i, "Relieve ").slice(0, 22) : "-", to: "/recommendations", provenance: "advisory" },
  ];

  return (
    <>
      {/* SECTION: THE STORY, END TO END */}
      <section>
        <SectionLabel label="The continuous story" hint="Every stage below is a real, clickable link to where that number is investigated further." />
        <DecisionChain nodes={chainNodes} />
      </section>

      {/* SECTION 1 - OPERATIONAL STATUS (unequal visual weight) */}
      <section className="grid gap-3 lg:grid-cols-[1fr_1fr_1.4fr_1fr]">
        <StatePanel label="Quality" value={`${(rootCause.overall_defect_rate * 100).toFixed(1)}%`} sub="defect rate" tone="neutral" />
        <StatePanel
          label="Production"
          value={Math.round(bottleneck.baseline_mean_output_parts_per_day).toLocaleString()}
          sub="parts/day"
          tone="neutral"
        />
        <StatePanel
          label="Current constraint"
          value={bottleneck.top_station}
          sub={`${(constraint.mean_utilization * 100).toFixed(0)}% utilization - active issue`}
          tone="critical"
          emphasized
          to={`/production-flow?station=${bottleneck.top_station}`}
        />
        <StatePanel label="Economics" value={profit ? formatINR(profit.profit) : "..."} sub="profit/day" tone="good" />
      </section>

      {/* AUTONOMOUS AGENT STRIP */}
      <Card
        title="Autonomous process agent"
        subtitle="Watching the real batch stream in the background - no manual refresh needed"
        action={
          <Link to="/agent" className="text-xs text-[var(--series-1)] hover:underline">
            Full activity log &rarr;
          </Link>
        }
      >
        {agentFeed.status ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-[var(--text-secondary)]">
              <span className="flex items-center gap-1.5 text-[var(--status-good)]">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--status-good)]" />
                Running - {agentFeed.status.tick_count.toLocaleString()} checks so far
              </span>
              <span>
                {agentFeed.status.cursor_batch_id.toLocaleString()} / {agentFeed.status.total_batches.toLocaleString()} real batches replayed
              </span>
              <span>{agentFeed.status.n_events.toLocaleString()} events flagged</span>
            </div>
            {agentFeed.events.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)]">No anomalies raised yet in this session.</p>
            ) : (
              <div className="space-y-1.5">
                {agentFeed.events.slice(0, 3).map((e) => (
                  <div key={e.id} className="flex items-center justify-between gap-3 rounded-md bg-[var(--surface-2)] px-3 py-2 text-xs">
                    <div className="flex items-center gap-2 truncate">
                      <Badge tone={e.severity === "critical" ? "critical" : "warning"}>
                        {e.kind === "drift" ? "Drift" : "Bottleneck"}
                      </Badge>
                      <span className="truncate text-[var(--text-secondary)]">{e.title}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-[var(--text-muted)]">Connecting to the autonomous agent...</p>
        )}
      </Card>

      {/* SECTION 2 - PROCESS FLOW */}
      <section>
        <SectionLabel label="Process flow" hint="Steel coil -> Blanking -> Pressing -> Assembly -> Paint -> QC. Click any stage to open it on Production Flow." />
        <Card action={<Link to="/production-flow" className="text-xs text-[var(--series-1)] hover:underline">Full view &rarr;</Link>}>
          {stations && <ProcessFlowDiagram stages={stations.stages} sharedResources={stations.shared_resources} />}
        </Card>
        <div className="mt-4">
          <Card title="Live batch stream" subtitle="Replaying real Model-3 batches in order">
            <LiveBatchTicker />
          </Card>
        </div>
      </section>

      {/* SECTION 3 + 4 - QUALITY INTELLIGENCE + ROOT-CAUSE SIGNAL */}
      <section className="grid gap-4 lg:grid-cols-2">
        <div>
          <SectionLabel label="Quality intelligence" hint="What defects are occurring and where is the strongest process signal?" />
          <Card>
            {topClass ? (
              <div>
                <div className="flex items-center justify-between">
                  <p className="text-lg font-semibold text-[var(--text-primary)]">{CLASS_META[topClass]?.label ?? topClass}</p>
                  <Badge tone={topClassAuc && topClassAuc > 0.55 ? "good" : "neutral"}>
                    {topClassAuc && topClassAuc > 0.55 ? "process-linked" : "weak signal"}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-[var(--text-secondary)]">
                  <span className="tabular-nums font-medium text-[var(--text-primary)]">{topClassCount.toLocaleString()}</span> occurrences -
                  most frequent real, process-linked defect class this session
                </p>
                {topClassStation && (
                  <p className="mt-3 text-sm text-[var(--text-secondary)]">
                    Associated process: <span className="font-medium text-[var(--text-primary)]">{topClassStation}</span>
                  </p>
                )}
                {topClassAuc !== undefined && (
                  <p className="mt-1 text-sm text-[var(--text-secondary)]">
                    Validation (held-out ROC-AUC): <span className="font-medium text-[var(--text-primary)]">{topClassAuc.toFixed(2)}</span> (0.5 = chance)
                  </p>
                )}
                <Link
                  to={`/defects?class=${topClass}`}
                  className="mt-4 inline-block rounded-md bg-[var(--series-1)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
                >
                  Trace root cause &rarr;
                </Link>
              </div>
            ) : (
              <p className="text-sm text-[var(--text-muted)]">No process-linked defect signal available.</p>
            )}
          </Card>
        </div>

        <div>
          <SectionLabel label="Root-cause signal" hint="A modeled association, not a claim of measured causality." />
          <Card>
            {topClass && topClassStation ? (
              <div className="space-y-3">
                <DecisionChain
                  nodes={[
                    { label: "Defect", value: CLASS_META[topClass]?.label ?? topClass, provenance: "real" },
                    { label: "Process", value: topClassStation, provenance: "derived" },
                    { label: "Signal", value: "Process-linked", provenance: "simulated" },
                    { label: "Driver", value: `${((topClassDrivers[0]?.importance ?? 0) * 100).toFixed(0)}% SHAP weight`, provenance: "model" },
                    { label: "Validation", value: `ROC-AUC ${topClassAuc?.toFixed(2) ?? "n/a"}`, provenance: "model" },
                  ]}
                />
                <p className="text-xs leading-relaxed text-[var(--text-muted)]">
                  The organizer dataset never recorded per-unit inspection outcomes, so this link comes from a
                  documented, parameterized simulation (see Methodology) feeding a real XGBoost + SHAP model - a{" "}
                  <strong className="text-[var(--text-secondary)]">modeled association</strong>, not measured causality.
                </p>
              </div>
            ) : (
              <p className="text-sm text-[var(--text-muted)]">No driver data available for this class.</p>
            )}
          </Card>
        </div>
      </section>

      {/* SECTION 5 - BOTTLENECK INTELLIGENCE */}
      <section>
        <SectionLabel label="Current production constraint" hint="Structural pressure ranking over the full real batch population." />
        <Card>
          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <p className="text-2xl font-semibold text-[var(--status-critical)]">{bottleneck.top_station}</p>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <MetricBlock label="Utilization" value={`${(constraint.mean_utilization * 100).toFixed(0)}%`} />
                <MetricBlock label="Queue" value={constraint.mean_queue.toFixed(0)} />
                <MetricBlock label="Pressure" value={constraint.pressure_score.toFixed(2)} />
                <MetricBlock label="Headroom" value={`${bottleneck.top_station_headroom_pct.toFixed(1)}%`} />
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Throughput impact</p>
              <div className="mt-2 space-y-1.5 text-sm">
                <Row label="Actual" value={`${Math.round(bottleneck.baseline_mean_output_parts_per_day).toLocaleString()}/day`} />
                <Row label="Theoretical (at saturation)" value={`${Math.round(theoreticalMaxOutput).toLocaleString()}/day`} />
                <Row label="Gap" value={`${Math.round(gap).toLocaleString()}/day`} tone="warning" />
                <Row label="Drift alerts (last 200 batches)" value={String(drift.n_alerts)} tone={drift.n_alerts > 5 ? "warning" : "good"} />
              </div>
              <Link
                to={`/production-flow?station=${bottleneck.top_station}`}
                className="mt-4 inline-block rounded-md bg-[var(--series-2)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
              >
                Analyze constraint &rarr;
              </Link>
            </div>
          </div>
        </Card>
      </section>

      {/* SECTION 6 - ECONOMIC IMPACT */}
      {profit && (
        <section>
          <SectionLabel label="Economic impact" hint="Formula-driven, using real throughput and defect rate. Cost inputs are user assumptions." />
          <Card action={<ProvenanceBadge kind="assumption" />}>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatTile label="Output / day" value={Math.round(profit.baseline_daily_output).toLocaleString()} unit="parts" />
              <StatTile label="Good parts" value={Math.round(profit.good_parts).toLocaleString()} tone="good" />
              <StatTile label="Defective parts" value={Math.round(profit.defective_parts).toLocaleString()} tone="warning" />
              <StatTile label="Scrap cost / day" value={formatINR(profit.scrap_cost)} tone="warning" />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatTile label="Operating cost / day" value={formatINR(profit.operating_cost)} />
              <StatTile
                label="Profit / day"
                value={formatINR(profit.profit)}
                tone={profit.profit >= 0 ? "good" : "critical"}
                hint={`${profit.margin_pct.toFixed(1)}% margin`}
              />
            </div>
            <div className="mt-4">
              <DecisionChain
                nodes={[
                  { label: "Defect rate", value: `${(rootCause.overall_defect_rate * 100).toFixed(1)}%`, provenance: "real" },
                  { label: "Good output", value: Math.round(profit.good_parts).toLocaleString(), provenance: "derived" },
                  { label: "Scrap", value: formatINR(profit.scrap_cost), provenance: "assumption" },
                  { label: "Revenue", value: formatINR(profit.revenue), provenance: "assumption" },
                  { label: "Profit", value: formatINR(profit.profit), provenance: "assumption" },
                ]}
              />
            </div>
            <Link to="/economics" className="mt-4 inline-block text-xs text-[var(--series-1)] hover:underline">
              Open Economics simulator &rarr;
            </Link>
          </Card>
        </section>
      )}

      {/* SECTION 7 - RECOMMENDATION */}
      {topRec && (
        <section>
          <SectionLabel label="Recommendation" hint="Advisory only - assembled from the same real reports shown above, never authored text." />
          <Card>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">{topRec.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-[var(--text-secondary)]">{topRec.reason}</p>
              </div>
              <Badge tone={topRec.confidence_pct >= 65 ? "good" : topRec.confidence_pct >= 35 ? "warning" : "neutral"}>
                {topRec.confidence_pct.toFixed(0)}% confidence
              </Badge>
            </div>
            <ul className="mt-3 space-y-1">
              {topRec.evidence.map((e, i) => (
                <li key={i} className="flex gap-2 text-xs text-[var(--text-muted)]">
                  <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-[var(--text-muted)]" />
                  {e}
                </li>
              ))}
            </ul>
            <Link
              to="/recommendations"
              className="mt-4 inline-block rounded-md bg-[var(--series-1)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
            >
              Open in Recommendations to simulate &rarr;
            </Link>
          </Card>
        </section>
      )}
    </>
  );
}

function SectionLabel({ label, hint }: { label: string; hint: string }) {
  return (
    <div className="mb-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">{label}</p>
      <p className="text-xs text-[var(--text-muted)]">{hint}</p>
    </div>
  );
}

function StatePanel({
  label,
  value,
  sub,
  tone,
  emphasized,
  to,
}: {
  label: string;
  value: string;
  sub: string;
  tone: "neutral" | "good" | "critical";
  emphasized?: boolean;
  to?: string;
}) {
  const toneColor = tone === "good" ? "var(--status-good)" : tone === "critical" ? "var(--status-critical)" : "var(--text-primary)";
  const content = (
    <div
      className={`h-full rounded-lg border px-4 py-4 transition-colors ${emphasized ? "border-[var(--status-critical)]/40 bg-[color-mix(in_oklab,var(--status-critical)_8%,var(--surface-1))]" : "border-white/10 bg-[var(--surface-1)]"} ${to ? "hover:border-[var(--status-critical)]/70" : ""}`}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">{label}</p>
      <p
        className={`mt-1.5 font-semibold tabular-nums ${emphasized ? "text-2xl" : "text-xl"}`}
        style={{ color: toneColor }}
      >
        {value}
      </p>
      <p className="mt-1 text-xs text-[var(--text-muted)]">{sub}</p>
    </div>
  );
  return to ? <Link to={to}>{content}</Link> : content;
}

function MetricBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-[var(--surface-2)] px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">{label}</p>
      <p className="tabular-nums text-base font-semibold text-[var(--text-primary)]">{value}</p>
    </div>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: "warning" | "good" }) {
  const color = tone === "warning" ? "var(--status-warning)" : tone === "good" ? "var(--status-good)" : "var(--text-primary)";
  return (
    <div className="flex items-center justify-between border-b border-white/5 py-1 last:border-0">
      <span className="text-[var(--text-muted)]">{label}</span>
      <span className="tabular-nums font-medium" style={{ color }}>
        {value}
      </span>
    </div>
  );
}
