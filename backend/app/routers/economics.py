from __future__ import annotations

from fastapi import APIRouter

from ..models.schemas import CostAssumptionsIn, WhatIfIn
from ..services.economics import CostAssumptions, compute_profitability, what_if_utilization_change
from ..services.root_cause import get_root_cause_report

router = APIRouter(prefix="/api/economics", tags=["economics"])


def _resolve_defect_rate(defect_rate: float | None) -> float:
    if defect_rate is not None:
        return defect_rate
    # Bare call, matching every other "give me the default report" call site
    # (main.py's warm-up, this function) - lru_cache keys on the literal
    # call shape, not the resolved default, so this must stay a bare call
    # for the warm-up to actually pre-populate what this reads. See
    # root_cause.py's DEFAULT_N_EVENTS / get_default_root_cause_report.
    return get_root_cause_report().overall_defect_rate


@router.post("/profitability")
def profitability(body: CostAssumptionsIn):
    defect_rate = _resolve_defect_rate(body.defect_rate)
    assumptions = CostAssumptions(
        unit_price=body.unit_price,
        scrap_cost_per_unit=body.scrap_cost_per_unit,
        operating_cost_per_hour=body.operating_cost_per_hour,
    )
    result = compute_profitability(assumptions, defect_rate, output_override=body.production_volume)
    return {
        "defect_rate_used": defect_rate,
        "production_volume_overridden": body.production_volume is not None,
        "baseline_daily_output": result.baseline_daily_output,
        "good_parts": result.good_parts,
        "defective_parts": result.defective_parts,
        "revenue": result.revenue,
        "scrap_cost": result.scrap_cost,
        "operating_cost": result.operating_cost,
        "downtime_opportunity_cost": result.downtime_opportunity_cost,
        "profit": result.profit,
        "margin_pct": result.margin_pct,
    }


@router.post("/what-if")
def what_if(body: WhatIfIn):
    defect_rate = _resolve_defect_rate(body.defect_rate)
    assumptions = CostAssumptions(
        unit_price=body.unit_price,
        scrap_cost_per_unit=body.scrap_cost_per_unit,
        operating_cost_per_hour=body.operating_cost_per_hour,
    )
    result = what_if_utilization_change(assumptions, defect_rate, body.station_overrides)
    return {
        "defect_rate_used": defect_rate,
        "baseline_output": result.baseline_output,
        "scenario_output": result.scenario_output,
        "output_delta": result.output_delta,
        "baseline_profit": result.baseline_profit,
        "scenario_profit": result.scenario_profit,
        "profit_delta": result.profit_delta,
        "caveat": (
            "scenario_output comes from a partial-dependence ML association (see /api/process/bottleneck "
            "caveat) - directional intuition, not a validated causal guarantee. Cost inputs are user "
            "assumptions (the organizer dataset has no currency figures at all); only the arithmetic connecting them is "
            "fixed."
        ),
    }
