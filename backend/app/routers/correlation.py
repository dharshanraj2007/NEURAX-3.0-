from __future__ import annotations

from fastapi import APIRouter

from ..services.defect_link_sim import METHODOLOGY_TEXT, batch_ordered_defect_probability
from ..services.root_cause import DEFAULT_N_EVENTS, get_root_cause_report

router = APIRouter(prefix="/api", tags=["correlation"])


@router.get("/root-cause")
def root_cause(n_events: int = DEFAULT_N_EVENTS):
    """n_events trades speed for statistical power: 20k (default) is
    responsive for interactive use; 60k+ gives more stable per-class ROC-AUC
    estimates (that's what was used to validate the methodology - see
    /api/methodology) at the cost of a slower first request.

    The default case is deliberately a bare `get_root_cause_report()` call
    (not `n_events=n_events`) so it hits the exact same lru_cache entry the
    startup warm-up populates - functools.lru_cache keys on the literal
    call shape, not the resolved default value, so `f(n_events=20_000)` and
    `f()` are two different cache entries even though they compute the same
    thing. That mismatch was a real bug found while building this (it also
    hit economics.py's defect-rate lookup) - every "give me the default
    report" call site must be a bare call for the warm-up to actually help.
    """
    report = get_root_cause_report() if n_events == DEFAULT_N_EVENTS else get_root_cause_report(n_events=n_events)
    return {
        "n_events": report.n_events,
        "overall_defect_rate": report.overall_defect_rate,
        "class_counts": report.class_counts,
        "top_drivers_by_class": report.top_drivers_by_class,
        "signal_strength_by_class": report.signal_strength_by_class,
        "roc_auc_by_class": report.roc_auc_by_class,
        "model_accuracy_cv": report.model_accuracy_cv,
        "note": (
            "roc_auc_by_class is the validity check: `inclusion` is deliberately given no station "
            "affinity in the simulator (modeled as a raw-material defect, independent of process stress), "
            "so it should sit close to 0.5 (chance) while the other five classes - which DO have a "
            "designed process affinity - should score meaningfully higher. signal_strength_by_class (raw "
            "mean |SHAP|) is shown for reference only; it is NOT a reliable cross-class validity check, "
            "since it is confounded by how many stations each class's affinity pattern involves."
        ),
    }


@router.get("/root-cause/trend")
def root_cause_trend(n_points: int = 300):
    points = batch_ordered_defect_probability(n_points=n_points)
    return {
        "points": points,
        "note": (
            "Deterministic simulated defect PROBABILITY (not a random draw) for batches sampled evenly, IN "
            "THEIR REAL RECORDED ORDER, across all 605,620 real batches. This is a trend across batch "
            "position, not calendar time (Model 3's rows are independent same-design replications, not a "
            "time series), but every station-stress value driving p_defect is real, measured data."
        ),
    }


@router.get("/methodology")
def methodology():
    return {"text": METHODOLOGY_TEXT}
