from __future__ import annotations

from fastapi import APIRouter

from ..models.schemas import CostAssumptionsIn
from ..services.economics import CostAssumptions
from ..services.recommendations import generate_recommendations

router = APIRouter(prefix="/api/recommendations", tags=["recommendations"])


@router.post("")
def recommendations(body: CostAssumptionsIn):
    assumptions = CostAssumptions(
        unit_price=body.unit_price,
        scrap_cost_per_unit=body.scrap_cost_per_unit,
        operating_cost_per_hour=body.operating_cost_per_hour,
    )
    recs = generate_recommendations(assumptions, body.defect_rate)
    return {
        "recommendations": [
            {
                "id": r.id,
                "title": r.title,
                "reason": r.reason,
                "evidence": r.evidence,
                "confidence_pct": r.confidence_pct,
                "expected_effect": r.expected_effect,
                "effect_caveat": r.effect_caveat,
                "simulate_endpoint": r.simulate_endpoint,
                "simulate_payload": r.simulate_payload,
            }
            for r in recs
        ],
        "disclaimer": (
            "All recommendations are advisory and simulated only. Nothing here controls, configures, or "
            "issues commands to any machine, PLC, or production-line hardware."
        ),
    }
