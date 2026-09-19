import { useState } from "react";
import { api, ApiError } from "../api/client";
import type { Recommendation, RecommendationsResponse, WhatIfResult, ProfitabilityResult } from "../api/types";
import { Badge } from "../components/Badge";
import { PageHeader } from "../components/PageHeader";
import { ErrorState, LoadingState } from "../components/LoadingState";
import { useApi } from "../hooks/useApi";
import { formatINRSigned } from "../utils/currency";

const DEFAULT_ASSUMPTIONS = { unit_price: 45, scrap_cost_per_unit: 18, operating_cost_per_hour: 900 };

export function Recommendations() {
  const recs = useApi<RecommendationsResponse>(() =>
    api.post("/api/recommendations", DEFAULT_ASSUMPTIONS)
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-8">
      <PageHeader
        eyebrow="InspectIQ / Action"
        title="Recommendations"
        description="What can we investigate? Generated programmatically from the same bottleneck, root-cause and drift reports served elsewhere - never authored text. Advisory and simulated only; nothing here controls equipment."
      />

      {recs.loading ? (
        <LoadingState label="Deriving recommendations from live bottleneck / root-cause / drift reports..." />
      ) : recs.error ? (
        <ErrorState message={recs.error} onRetry={recs.reload} />
      ) : (
        <>
          <div className="space-y-4">
            {recs.data!.recommendations.map((r) => (
              <RecommendationCard key={r.id} rec={r} />
            ))}
          </div>
          <p className="rounded-md border border-white/10 bg-[var(--surface-1)] p-4 text-xs leading-relaxed text-[var(--text-muted)]">
            {recs.data!.disclaimer}
          </p>
        </>
      )}
    </div>
  );
}

function RecommendationCard({ rec }: { rec: Recommendation }) {
  const [expanded, setExpanded] = useState(false);
  const [simLoading, setSimLoading] = useState(false);
  const [simResult, setSimResult] = useState<WhatIfResult | ProfitabilityResult | Record<string, unknown> | null>(null);
  const [simError, setSimError] = useState<string | null>(null);

  const confidenceTone = rec.confidence_pct >= 65 ? "good" : rec.confidence_pct >= 35 ? "warning" : "neutral";

  const runSimulation = () => {
    setSimLoading(true);
    setSimError(null);
    const method = rec.simulate_endpoint.includes("what-if") || rec.simulate_endpoint.includes("profitability") ? "post" : "get";
    const call =
      method === "post"
        ? api.post(rec.simulate_endpoint, rec.simulate_payload)
        : api.get(`${rec.simulate_endpoint}?${new URLSearchParams(rec.simulate_payload as Record<string, string>).toString()}`);
    call
      .then((res) => setSimResult(res as Record<string, unknown>))
      .catch((err) => setSimError(err instanceof ApiError ? err.message : String(err)))
      .finally(() => setSimLoading(false));
  };

  return (
    <div className="rounded-lg border border-white/10 bg-[var(--surface-1)] p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">{rec.title}</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-[var(--text-secondary)]">{rec.reason}</p>
        </div>
        <Badge tone={confidenceTone}>{rec.confidence_pct.toFixed(0)}% confidence</Badge>
      </div>

      {Object.keys(rec.expected_effect).length > 0 && (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {Object.entries(rec.expected_effect).map(([key, value]) => (
            <EffectTile key={key} label={humanizeKey(key)} value={value} />
          ))}
        </div>
      )}

      <button onClick={() => setExpanded((e) => !e)} className="mt-3 text-xs text-[var(--series-1)] hover:underline">
        {expanded ? "Hide evidence" : "View evidence"}
      </button>

      {expanded && (
        <ul className="mt-2 space-y-1">
          {rec.evidence.map((e, i) => (
            <li key={i} className="flex gap-2 text-xs text-[var(--text-muted)]">
              <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-[var(--text-muted)]" />
              {e}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 flex items-center gap-3 border-t border-white/5 pt-4">
        <button
          onClick={runSimulation}
          disabled={simLoading}
          className="rounded-md bg-[var(--series-1)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {simLoading ? "Simulating..." : "Simulate"}
        </button>
        <span className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">Advisory only - no equipment control</span>
      </div>

      {simError && <p className="mt-2 text-xs text-[var(--status-critical)]">{simError}</p>}
      {simResult && (
        <pre className="mt-3 overflow-x-auto rounded-md bg-[var(--surface-2)] p-3 text-[11px] leading-relaxed text-[var(--text-secondary)]">
          {JSON.stringify(simResult, null, 2)}
        </pre>
      )}
    </div>
  );
}

function EffectTile({ label, value }: { label: string; value: number }) {
  const isMoney = label.toLowerCase().includes("profit");
  const tone = value >= 0 ? "var(--status-good)" : "var(--status-critical)";
  const formatted = isMoney ? formatINRSigned(value) : `${value >= 0 ? "+" : ""}${value.toFixed(2)}`;
  return (
    <div className="rounded-md bg-[var(--surface-2)] p-3">
      <p className="text-[10px] text-[var(--text-muted)]">{label}</p>
      <p className="tabular-nums text-sm font-semibold" style={{ color: tone }}>
        {formatted}
      </p>
    </div>
  );
}

function humanizeKey(key: string): string {
  return key
    .replace(/_pct_points$/i, "_pct")
    .replace(/_/g, " ")
    .replace(/\bpct\b/gi, "%")
    .replace(/\bper day\b/gi, "/day")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
