import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import type { RootCauseReport } from "../api/types";
import { Card } from "../components/Card";
import { Badge } from "../components/Badge";
import { PageHeader } from "../components/PageHeader";
import { ErrorState, LoadingState } from "../components/LoadingState";
import { FocusBanner, useClearFocusParam } from "../components/FocusBanner";
import { useApi } from "../hooks/useApi";
import { DriverBarChart } from "../components/charts/DriverBarChart";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine } from "recharts";

export function RootCause() {
  const report = useApi<RootCauseReport>(() => api.get("/api/root-cause"));
  const [searchParams] = useSearchParams();
  const focusClass = searchParams.get("class");
  const clearFocus = useClearFocusParam(["class"]);

  const focusDrivers = focusClass ? report.data?.top_drivers_by_class[focusClass] : undefined;
  const topDriverStation = focusDrivers?.[0]?.station;

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-8">
      <PageHeader
        eyebrow="InspectIQ / Investigation"
        title="Root-Cause Correlation"
        description="Why is a defect associated with a given process condition? A documented, parameterized simulation links real process stress to defect families, explained with a real XGBoost classifier and real SHAP values."
      />

      {focusClass && (
        <FocusBanner
          label={
            topDriverStation
              ? `Defect class "${focusClass}" from Defects - top driver is ${topDriverStation}`
              : `Defect class "${focusClass}" from Defects`
          }
          onClear={clearFocus}
        />
      )}

      {report.loading ? (
        <LoadingState label="Training XGBoost + computing SHAP on the process-linked inspection stream (first load only)..." />
      ) : report.error ? (
        <ErrorState message={report.error} onRetry={report.reload} />
      ) : (
        <>
          <Card title="Validity check: held-out ROC-AUC by defect class" subtitle={report.data!.note}>
            <RocAucChart data={report.data!.roc_auc_by_class} />
            <p className="mt-2 text-xs text-[var(--text-muted)]">
              <code className="rounded bg-[var(--surface-2)] px-1 py-0.5">inclusion</code> is deliberately given
              no process affinity in the simulator (modeled as a raw-material defect) - it sitting at chance
              (0.5, dashed line) while the others score higher is the pipeline behaving correctly, not a weak
              result.
            </p>
          </Card>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <SummaryStat label="Simulated events" value={report.data!.n_events.toLocaleString()} />
            <SummaryStat label="Overall defect rate" value={`${(report.data!.overall_defect_rate * 100).toFixed(1)}%`} />
            <SummaryStat label="Holdout accuracy" value={`${(report.data!.model_accuracy_cv * 100).toFixed(1)}%`} />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {Object.entries(report.data!.top_drivers_by_class).map(([cls, drivers]) => {
              const isFocused = cls === focusClass;
              const top = drivers[0]?.station;
              return (
                <Card
                  key={cls}
                  className={isFocused ? "ring-2 ring-[var(--series-1)]" : undefined}
                  title={cls}
                  subtitle={`${report.data!.class_counts[cls] ?? 0} simulated occurrences`}
                  action={
                    isFocused && top ? <Badge tone="good">focused</Badge> : undefined
                  }
                >
                  <DriverBarChart drivers={drivers} />
                  {top && (
                    <Link
                      to={`/production-flow?station=${top}`}
                      className="mt-3 inline-block text-xs text-[var(--series-1)] hover:underline"
                    >
                      View {top} on Production Flow &rarr;
                    </Link>
                  )}
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-[var(--surface-1)] px-4 py-3">
      <p className="text-xs text-[var(--text-muted)]">{label}</p>
      <p className="tabular-nums text-lg font-semibold text-[var(--text-primary)]">{value}</p>
    </div>
  );
}

function RocAucChart({ data }: { data: Record<string, number> }) {
  const rows = Object.entries(data)
    .map(([cls, auc]) => ({ cls, auc }))
    .sort((a, b) => a.auc - b.auc);
  return (
    <ResponsiveContainer debounce={200} width="100%" height={Math.max(200, rows.length * 34)}>
      <BarChart data={rows} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
        <CartesianGrid horizontal={false} stroke="var(--gridline)" />
        <XAxis
          type="number"
          domain={[0.3, 0.8]}
          tick={{ fill: "var(--text-muted)", fontSize: 11 }}
          axisLine={{ stroke: "var(--baseline)" }}
          tickLine={false}
        />
        <YAxis type="category" dataKey="cls" width={110} tick={{ fill: "var(--text-secondary)", fontSize: 12 }} axisLine={{ stroke: "var(--baseline)" }} tickLine={false} />
        <ReferenceLine x={0.5} stroke="var(--text-muted)" strokeDasharray="4 4" />
        <Tooltip
          contentStyle={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
          formatter={(value) => [Number(value).toFixed(3), "ROC-AUC"]}
        />
        <Bar dataKey="auc" radius={[0, 4, 4, 0]} maxBarSize={16}>
          {rows.map((r) => (
            <Cell key={r.cls} fill={r.cls === "inclusion" ? "var(--baseline)" : "var(--series-1)"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
