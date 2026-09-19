import { useState } from "react";
import { Link } from "react-router-dom";
import { api, BASE_URL } from "../api/client";
import type { RootCauseReport } from "../api/types";
import { Card } from "../components/Card";
import { Badge } from "../components/Badge";
import { PageHeader } from "../components/PageHeader";
import { ErrorState, LoadingState } from "../components/LoadingState";
import { useApi } from "../hooks/useApi";
import { CLASS_META, CLASS_ORDER } from "../constants/defectClasses";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function Defects() {
  const rc = useApi<RootCauseReport>(() => api.get("/api/root-cause"));
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-8">
      <PageHeader
        eyebrow="InspectIQ / Quality"
        title="Defect Intelligence"
        description="What defects are occurring, how often, and where is the strongest process signal? The six real NEU-DET steel surface-defect classes the vision model is trained to recognize."
      />

      {rc.loading ? (
        <LoadingState />
      ) : rc.error ? (
        <ErrorState message={rc.error} onRetry={rc.reload} />
      ) : (
        <>
          <Card title="Defect distribution" subtitle={`${rc.data!.n_events.toLocaleString()} simulated inspection events`}>
            <DistributionChart classCounts={rc.data!.class_counts} />
          </Card>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {CLASS_ORDER.map((cls) => (
              <DefectClassCard
                key={cls}
                cls={cls}
                count={rc.data!.class_counts[cls] ?? 0}
                totalEvents={rc.data!.n_events}
                rocAuc={rc.data!.roc_auc_by_class[cls]}
                selected={selected === cls}
                onClick={() => setSelected(selected === cls ? null : cls)}
              />
            ))}
          </div>

          {selected && (
            <DefectDrillDown
              cls={selected}
              drivers={rc.data!.top_drivers_by_class[selected] ?? []}
              rocAuc={rc.data!.roc_auc_by_class[selected]}
              count={rc.data!.class_counts[selected] ?? 0}
            />
          )}
        </>
      )}
    </div>
  );
}

function DistributionChart({ classCounts }: { classCounts: Record<string, number> }) {
  const data = CLASS_ORDER.map((cls) => ({ cls, label: CLASS_META[cls].label, count: classCounts[cls] ?? 0 })).sort(
    (a, b) => a.count - b.count
  );
  return (
    <ResponsiveContainer debounce={200} width="100%" height={260}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
        <CartesianGrid horizontal={false} stroke="var(--gridline)" />
        <XAxis type="number" tick={{ fill: "var(--text-muted)", fontSize: 11 }} axisLine={{ stroke: "var(--baseline)" }} tickLine={false} />
        <YAxis type="category" dataKey="label" width={110} tick={{ fill: "var(--text-secondary)", fontSize: 12 }} axisLine={{ stroke: "var(--baseline)" }} tickLine={false} />
        <Tooltip
          cursor={{ fill: "rgba(255,255,255,0.04)" }}
          contentStyle={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
          formatter={(value) => [Number(value).toLocaleString(), "Simulated occurrences"]}
        />
        <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={18}>
          {data.map((d) => (
            <Cell key={d.cls} fill={CLASS_META[d.cls].color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function DefectClassCard({
  cls,
  count,
  totalEvents,
  rocAuc,
  selected,
  onClick,
}: {
  cls: string;
  count: number;
  totalEvents: number;
  rocAuc: number | undefined;
  selected: boolean;
  onClick: () => void;
}) {
  const meta = CLASS_META[cls];
  const rate = totalEvents ? (count / totalEvents) * 100 : 0;
  const linked = rocAuc !== undefined && rocAuc > 0.55;
  return (
    <button
      onClick={onClick}
      className={`rounded-lg border p-4 text-left transition-colors ${
        selected ? "border-[var(--series-1)] bg-[var(--series-1)]/10" : "border-white/10 bg-[var(--surface-1)] hover:border-white/20"
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: meta.color }} />
          {meta.label}
        </span>
        {cls === "inclusion" ? (
          <Badge tone="neutral">no process link (by design)</Badge>
        ) : (
          <Badge tone={linked ? "good" : "neutral"}>{linked ? "process-linked" : "weak signal"}</Badge>
        )}
      </div>
      <p className="mt-2 text-xs leading-relaxed text-[var(--text-muted)]">{meta.description}</p>
      <div className="mt-3 flex items-center justify-between text-xs">
        <span className="text-[var(--text-secondary)]">
          <span className="tabular-nums font-medium text-[var(--text-primary)]">{count.toLocaleString()}</span> occurrences
        </span>
        <span className="tabular-nums text-[var(--text-secondary)]">{rate.toFixed(2)}% of events</span>
      </div>
    </button>
  );
}

function DefectDrillDown({
  cls,
  drivers,
  rocAuc,
  count,
}: {
  cls: string;
  drivers: { station: string; importance: number }[];
  rocAuc: number | undefined;
  count: number;
}) {
  const meta = CLASS_META[cls];
  return (
    <Card
      title={`${meta.label} - drill-down`}
      subtitle={`${count.toLocaleString()} simulated occurrences`}
      action={
        cls !== "inclusion" && drivers.length > 0 ? (
          <Link
            to={`/root-cause?class=${cls}`}
            className="text-xs text-[var(--series-1)] hover:underline"
          >
            Trace root cause &rarr;
          </Link>
        ) : undefined
      }
    >
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">Real example image (held-out val set)</p>
          <img
            key={cls}
            src={`${BASE_URL}/api/vision/sample-image/${cls}`}
            alt={`${meta.label} example`}
            className="w-full rounded-lg border border-white/10 bg-black"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        </div>
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">Associated process signals</p>
          {cls === "inclusion" ? (
            <p className="text-sm text-[var(--text-secondary)]">
              This class is deliberately modeled with no process affinity (raw-material-intrinsic defect) - its
              held-out ROC-AUC ({rocAuc?.toFixed(2) ?? "n/a"}) sitting near 0.5 (chance) is the expected, correct
              result, not a weak model.
            </p>
          ) : (
            <>
              <p className="mb-3 text-sm text-[var(--text-secondary)]">
                Held-out ROC-AUC: <span className="font-medium text-[var(--text-primary)]">{rocAuc?.toFixed(2) ?? "n/a"}</span> (0.5 = chance)
              </p>
              <ul className="space-y-2">
                {drivers.map((d) => (
                  <li key={d.station} className="flex items-center justify-between text-sm">
                    <span className="text-[var(--text-secondary)]">{d.station}</span>
                    <span className="tabular-nums text-[var(--text-primary)]">{(d.importance * 100).toFixed(0)}%</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </Card>
  );
}
