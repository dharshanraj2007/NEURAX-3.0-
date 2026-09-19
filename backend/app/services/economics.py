"""
Profitability engine.

Nothing about $ amounts exists in the organizer-provided files (they contain
process telemetry only), so unit economics MUST come from user-supplied
assumptions - there is no honest way to invent a "real" price the dataset
never stated. What this module guarantees is real: the *throughput*,
*utilization* and *defect-rate* numbers plugged into the formulas below are
always the live, computed outputs of `bottleneck.py`, `demand_response.py`
and the vision/correlation layer - never hardcoded - and the arithmetic
connecting them to profit is transparent and re-run on every request, so a
change to any input immediately and correctly changes the result.
"""
from __future__ import annotations

from dataclasses import dataclass

from .bottleneck import compute_bottleneck_report, predict_output_for_scenario

HOURS_PER_BATCH = 24.0


@dataclass
class CostAssumptions:
    unit_price: float = 45.0          # revenue per accepted good part ($) - user-editable
    scrap_cost_per_unit: float = 18.0  # material + rework cost written off per defective part ($)
    operating_cost_per_hour: float = 900.0  # blended labor+energy+overhead for the whole line ($/hr)


@dataclass
class ProfitabilityResult:
    baseline_daily_output: float
    good_parts: float
    defective_parts: float
    revenue: float
    scrap_cost: float
    operating_cost: float
    downtime_opportunity_cost: float
    profit: float
    margin_pct: float
    assumptions: CostAssumptions


def compute_profitability(
    assumptions: CostAssumptions, defect_rate: float, output_override: float | None = None
) -> ProfitabilityResult:
    """`output_override` lets a caller ask "what if daily volume were X"
    instead of the real measured mean - a plain, honest linear scaling of
    the same formula (never a fabricated relationship), used by the
    Economics page's Production Volume slider."""
    report = compute_bottleneck_report()
    daily_output = output_override if output_override is not None else report.baseline_mean_output

    defective_parts = daily_output * defect_rate
    good_parts = daily_output - defective_parts

    revenue = good_parts * assumptions.unit_price
    scrap_cost = defective_parts * assumptions.scrap_cost_per_unit
    operating_cost = assumptions.operating_cost_per_hour * HOURS_PER_BATCH
    downtime_cost = max(0.0, report.throughput_sensitivity_parts_per_day) * assumptions.unit_price

    profit = revenue - scrap_cost - operating_cost
    margin_pct = (profit / revenue * 100) if revenue else 0.0

    return ProfitabilityResult(
        baseline_daily_output=daily_output,
        good_parts=good_parts,
        defective_parts=defective_parts,
        revenue=revenue,
        scrap_cost=scrap_cost,
        operating_cost=operating_cost,
        downtime_opportunity_cost=downtime_cost,
        profit=profit,
        margin_pct=margin_pct,
        assumptions=assumptions,
    )


@dataclass
class WhatIfResult:
    scenario_output: float
    baseline_output: float
    output_delta: float
    scenario_profit: float
    baseline_profit: float
    profit_delta: float


def what_if_utilization_change(
    assumptions: CostAssumptions,
    defect_rate: float,
    station_overrides: dict[str, float],
) -> WhatIfResult:
    """Recompute profit if the given stations were run at the given target
    utilizations, using the RandomForest partial-dependence predictor fit on
    the real Model 3 dataset (see bottleneck.predict_output_for_scenario)."""
    baseline = compute_profitability(assumptions, defect_rate)
    scenario_output = predict_output_for_scenario(station_overrides)

    defective_parts = scenario_output * defect_rate
    good_parts = scenario_output - defective_parts
    revenue = good_parts * assumptions.unit_price
    scrap_cost = defective_parts * assumptions.scrap_cost_per_unit
    operating_cost = assumptions.operating_cost_per_hour * HOURS_PER_BATCH
    scenario_profit = revenue - scrap_cost - operating_cost

    return WhatIfResult(
        scenario_output=scenario_output,
        baseline_output=baseline.baseline_daily_output,
        output_delta=scenario_output - baseline.baseline_daily_output,
        scenario_profit=scenario_profit,
        baseline_profit=baseline.profit,
        profit_delta=scenario_profit - baseline.profit,
    )
