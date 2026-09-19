import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api, ApiError } from "../api/client";
import type { ProfitabilityResult, WhatIfResult } from "../api/types";
import { Card } from "../components/Card";
import { StatTile } from "../components/StatTile";
import { ErrorState, LoadingState } from "../components/LoadingState";
import { FocusBanner, useClearFocusParam } from "../components/FocusBanner";
import { PageHeader } from "../components/PageHeader";
import { ProvenanceBadge } from "../components/ProvenanceBadge";
import { formatINR } from "../utils/currency";

export function Economics() {
  const [searchParams] = useSearchParams();
  const focusStationParam = searchParams.get("station");
  const focusTargetParam = searchParams.get("target");
  const clearFocus = useClearFocusParam(["station", "target"]);

  const [unitPrice, setUnitPrice] = useState(45);
  const [scrapCost, setScrapCost] = useState(18);
  const [operatingCost, setOperatingCost] = useState(900);
  const [defectRateOverride, setDefectRateOverride] = useState<number | null>(null);
  const [volumeOverride, setVolumeOverride] = useState<number | null>(null);

  const [current, setCurrent] = useState<ProfitabilityResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [targetStation, setTargetStation] = useState(focusStationParam ?? "Forklift");
  const [stationTarget, setStationTarget] = useState(
    focusTargetParam ? Number(focusTargetParam) : 0.6
  );
  const [whatIf, setWhatIf] = useState<WhatIfResult | null>(null);
  const [whatIfLoading, setWhatIfLoading] = useState(false);
  const [scenarioProfit, setScenarioProfit] = useState<ProfitabilityResult | null>(null);

  const fetchCurrent = () => {
    setLoading(true);
    setError(null);
    api
      .post<ProfitabilityResult>("/api/economics/profitability", {
        unit_price: unitPrice,
        scrap_cost_per_unit: scrapCost,
        operating_cost_per_hour: operatingCost,
      })
      .then(setCurrent)
      .catch((err) => setError(err instanceof ApiError ? err.message : String(err)))
      .finally(() => setLoading(false));
  };

  useEffect(fetchCurrent, []);

  const runScenario = () => {
    setWhatIfLoading(true);
    Promise.all([
      api.post<WhatIfResult>("/api/economics/what-if", {
        unit_price: unitPrice,
        scrap_cost_per_unit: scrapCost,
        operating_cost_per_hour: operatingCost,
        defect_rate: defectRateOverride,
        station_overrides: { [targetStation]: stationTarget },
      }),
      api.post<ProfitabilityResult>("/api/economics/profitability", {
        unit_price: unitPrice,
        scrap_cost_per_unit: scrapCost,
        operating_cost_per_hour: operatingCost,
        defect_rate: defectRateOverride,
        production_volume: volumeOverride,
      }),
    ])
      .then(([wi, prof]) => {
        setWhatIf(wi);
        setScenarioProfit(prof);
      })
      .catch(() => void 0)
      .finally(() => setWhatIfLoading(false));
  };

  // Auto-run the what-if scenario exactly once when this page was reached via
  // a real drill-through link (Production Flow's "Simulate relieving X" ->
  // /economics?station=X&target=Y) - the carried context should immediately
  // produce a result, not require an extra click to "confirm" what was just clicked.
  const autoRan = useRef(false);
  useEffect(() => {
    if (autoRan.current || !focusStationParam) return;
    autoRan.current = true;
    runScenario();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusStationParam]);

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-8">
      <PageHeader
        eyebrow="InspectIQ / Decision Simulator"
        title="Economics"
        description="What does it cost, and what would change if we relieved the constraint? All figures in INR (₹). The organizer dataset has no currency figures at all, so unit economics are your assumptions - the arithmetic connecting them to real throughput and defect rate is fixed and recalculates live."
        status={<ProvenanceBadge kind="assumption" />}
      />

      {focusStationParam && (
        <FocusBanner
          label={`Station "${focusStationParam}" from Production Flow - target ${(stationTarget * 100).toFixed(0)}% utilization`}
          onClear={clearFocus}
        />
      )}

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <Card title="Assumptions">
          <div className="space-y-4">
            <SliderField label="Unit price" value={unitPrice} min={10} max={150} step={1} unit="₹" onChange={setUnitPrice} />
            <SliderField label="Scrap cost / unit" value={scrapCost} min={2} max={80} step={1} unit="₹" onChange={setScrapCost} />
            <SliderField
              label="Operating cost / hour"
              value={operatingCost}
              min={200}
              max={3000}
              step={25}
              unit="₹"
              onChange={setOperatingCost}
            />
            <button
              onClick={fetchCurrent}
              className="w-full rounded-md border border-white/15 px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:bg-white/5"
            >
              Apply to current scenario
            </button>
          </div>
        </Card>

        <div className="space-y-6">
          <Card title="Current scenario" subtitle="Formula-driven, using the real measured mean daily output">
            {loading && <LoadingState label="Computing profitability..." />}
            {error && <ErrorState message={error} onRetry={fetchCurrent} />}
            {current && !loading && (
              <>
                <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                  <StatTile label="Revenue / day" value={formatINR(current.revenue)} />
                  <StatTile label="Scrap cost / day" value={formatINR(current.scrap_cost)} tone="warning" />
                  <StatTile label="Operating cost / day" value={formatINR(current.operating_cost)} />
                  <StatTile
                    label="Profit / day"
                    value={formatINR(current.profit)}
                    tone={current.profit >= 0 ? "good" : "critical"}
                    hint={`${current.margin_pct.toFixed(1)}% margin`}
                  />
                </div>
                <div className="mt-4 space-y-2 text-sm">
                  <Row label="Daily output (real, mean of Model-3 batches)" value={`${Math.round(current.baseline_daily_output).toLocaleString()} parts`} />
                  <Row label="Good parts" value={Math.round(current.good_parts).toLocaleString()} />
                  <Row label="Defective parts" value={Math.round(current.defective_parts).toLocaleString()} />
                  <Row label="Defect rate used" value={`${(current.defect_rate_used * 100).toFixed(1)}%`} />
                  <Row label="Downtime opportunity cost" value={formatINR(current.downtime_opportunity_cost)} />
                </div>
              </>
            )}
          </Card>

          <Card
            title="What-if simulator"
            subtitle={`Edit defect rate, production volume and the ${targetStation} bottleneck target, then compare against the current scenario`}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <OptionalSliderField
                label="Defect rate override"
                value={defectRateOverride}
                defaultValue={0.065}
                min={0}
                max={0.3}
                step={0.005}
                format={(v) => `${(v * 100).toFixed(1)}%`}
                onChange={setDefectRateOverride}
              />
              <OptionalSliderField
                label="Production volume override"
                value={volumeOverride}
                defaultValue={current?.baseline_daily_output ?? 54000}
                min={20000}
                max={80000}
                step={500}
                format={(v) => `${Math.round(v).toLocaleString()} parts/day`}
                onChange={setVolumeOverride}
              />
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_2fr]">
              <div>
                <label className="text-xs font-medium text-[var(--text-muted)]">Station</label>
                <input
                  type="text"
                  value={targetStation}
                  onChange={(e) => setTargetStation(e.target.value)}
                  className="mt-1.5 w-full rounded-md border border-white/15 bg-[var(--surface-2)] px-2 py-1.5 text-sm text-[var(--text-primary)] focus:border-[var(--series-1)] focus:outline-none"
                  placeholder="e.g. Forklift, Press1, Cell2"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-[var(--text-muted)]">
                  Target utilization: <span className="tabular-nums text-[var(--text-primary)]">{(stationTarget * 100).toFixed(0)}%</span>
                </label>
                <input
                  type="range"
                  min={0.1}
                  max={0.95}
                  step={0.01}
                  value={stationTarget}
                  onChange={(e) => setStationTarget(Number(e.target.value))}
                  className="mt-2.5 w-full accent-[var(--series-2)]"
                />
              </div>
            </div>

            <button
              onClick={runScenario}
              disabled={whatIfLoading}
              className="mt-4 rounded-md bg-[var(--series-2)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {whatIfLoading ? "Simulating..." : "Run scenario"}
            </button>

            {whatIf && scenarioProfit && current && (
              <div className="mt-5">
                <ComparisonTable current={current} scenario={scenarioProfit} whatIf={whatIf} station={targetStation} />
                {whatIf.caveat && (
                  <p className="mt-3 rounded-md bg-[var(--status-warning)]/10 p-3 text-xs leading-relaxed text-[var(--status-warning)]">
                    {whatIf.caveat}
                  </p>
                )}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function ComparisonTable({
  current,
  scenario,
  whatIf,
  station,
}: {
  current: ProfitabilityResult;
  scenario: ProfitabilityResult;
  whatIf: WhatIfResult;
  station: string;
}) {
  const rows: [string, string, string][] = [
    [`Throughput (${station} what-if)`, `${Math.round(whatIf.baseline_output).toLocaleString()}/day`, `${Math.round(whatIf.scenario_output).toLocaleString()}/day`],
    ["Defect rate", `${(current.defect_rate_used * 100).toFixed(1)}%`, `${(scenario.defect_rate_used * 100).toFixed(1)}%`],
    ["Scrap cost / day", formatINR(current.scrap_cost), formatINR(scenario.scrap_cost)],
    ["Margin", `${current.margin_pct.toFixed(1)}%`, `${scenario.margin_pct.toFixed(1)}%`],
  ];
  return (
    <table className="w-full text-left text-sm">
      <thead className="text-xs uppercase text-[var(--text-muted)]">
        <tr>
          <th className="pb-2 pr-4">Metric</th>
          <th className="pb-2 pr-4">Current</th>
          <th className="pb-2">Scenario</th>
        </tr>
      </thead>
      <tbody className="tabular-nums text-[var(--text-secondary)]">
        {rows.map(([label, cur, scen]) => (
          <tr key={label} className="border-t border-white/5">
            <td className="py-1.5 pr-4 text-[var(--text-primary)]">{label}</td>
            <td className="py-1.5 pr-4">{cur}</td>
            <td className="py-1.5 font-medium text-[var(--series-1)]">{scen}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function SliderField({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <label className="flex items-center justify-between text-xs font-medium text-[var(--text-muted)]">
        <span>{label}</span>
        <span className="tabular-nums text-[var(--text-primary)]">
          {unit}
          {value}
        </span>
      </label>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 w-full accent-[var(--series-1)]"
      />
    </div>
  );
}

function OptionalSliderField({
  label,
  value,
  defaultValue,
  min,
  max,
  step,
  format,
  onChange,
}: {
  label: string;
  value: number | null;
  defaultValue: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number | null) => void;
}) {
  return (
    <div>
      <label className="flex items-center justify-between text-xs font-medium text-[var(--text-muted)]">
        <span>{label}</span>
        <button className="text-[var(--series-1)] hover:underline" onClick={() => onChange(value === null ? defaultValue : null)}>
          {value === null ? "override" : "use default"}
        </button>
      </label>
      {value !== null && (
        <>
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
            className="mt-2 w-full accent-[var(--series-1)]"
          />
          <p className="tabular-nums mt-1 text-xs text-[var(--text-secondary)]">{format(value)}</p>
        </>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between border-b border-white/5 py-1.5 last:border-0">
      <span className="text-[var(--text-muted)]">{label}</span>
      <span className="tabular-nums text-[var(--text-primary)]">{value}</span>
    </div>
  );
}
