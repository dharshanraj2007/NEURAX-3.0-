from __future__ import annotations

from fastapi import APIRouter

from ..services.bottleneck import compute_bottleneck_report, detect_drift
from ..services.data_loader import load_model3
from ..services.demand_response import get_demand_response_model
from ..services.station_specs import PROCESS_STAGES, STAGE_TO_STATIONS, STATION_SPECS

router = APIRouter(prefix="/api/process", tags=["process"])


@router.get("/stations")
def stations():
    """Merges the real, measured bottleneck ranking with the documented
    (Model 3.pdf) process specification for each station/resource, grouped
    by the five named process stages - the shape the Production Flow page
    needs. capacity/cycle_time_desc come from the PDF (design spec, never
    logged in the CSV); utilization/queue/pressure_score/status come from
    the real measured data via compute_bottleneck_report()."""
    report = compute_bottleneck_report()
    by_station = {s.station: s for s in report.ranking}

    stages = []
    for stage in PROCESS_STAGES:
        station_ids = STAGE_TO_STATIONS[stage]
        resources = []
        for station_id in station_ids:
            spec = STATION_SPECS[station_id]
            measured = by_station.get(station_id)
            status = "normal"
            if measured:
                if station_id == report.top_station:
                    status = "constraint"
                elif measured.pressure_score >= 0.5:
                    status = "watch"
            resources.append(
                {
                    "id": station_id,
                    "label": spec.label,
                    "capacity": spec.capacity,
                    "cycle_time_desc": spec.cycle_time_desc,
                    "mean_utilization": measured.mean_utilization if measured else None,
                    "mean_queue": measured.mean_queue if measured else None,
                    "pressure_score": measured.pressure_score if measured else None,
                    "is_pass_through": measured.is_pass_through if measured else None,
                    "status": status,
                }
            )
        stages.append({"stage": stage, "resources": resources})

    forklift = by_station.get("Forklift")
    shared_resources = []
    if forklift:
        spec = STATION_SPECS["Forklift"]
        shared_resources.append(
            {
                "id": "Forklift",
                "label": spec.label,
                "role": "Material movement between Blanking, Pressing and Assembly stages",
                "cycle_time_desc": spec.cycle_time_desc,
                "mean_utilization": forklift.mean_utilization,
                "mean_queue": forklift.mean_queue,
                "pressure_score": forklift.pressure_score,
                "status": "constraint" if report.top_station == "Forklift" else (
                    "watch" if forklift.pressure_score >= 0.5 else "normal"
                ),
            }
        )

    return {
        "stages": stages,
        "shared_resources": shared_resources,
        "top_station": report.top_station,
        "n_batches_analyzed": report.n_batches_analyzed,
    }


@router.get("/bottleneck")
def bottleneck():
    report = compute_bottleneck_report()
    return {
        "top_station": report.top_station,
        "n_batches_analyzed": report.n_batches_analyzed,
        "baseline_mean_output_parts_per_day": report.baseline_mean_output,
        "top_station_headroom_pct": report.top_station_headroom_pct,
        "throughput_sensitivity_parts_per_day": report.throughput_sensitivity_parts_per_day,
        "ranking": [
            {
                "station": s.station,
                "mean_utilization": s.mean_utilization,
                "mean_queue": s.mean_queue,
                "pressure_score": s.pressure_score,
                "is_pass_through": s.is_pass_through,
            }
            for s in report.ranking
        ],
        "driver_importance": report.driver_importance,
        "caveat": (
            "throughput_sensitivity is a partial-dependence ML association (RandomForest fit on "
            "independent daily replications of ONE fixed capacity design), not a controlled-experiment "
            "causal effect - this dataset has no capacity-sweep to identify true causal slopes, so treat "
            "the sign/magnitude as directional intuition only. headroom_pct (1 - utilization) is the "
            "uncontroversial number: real spare capacity before that resource saturates. For a rigorously "
            "causal capacity/throughput relationship, see /api/process/demand-response, which is fit on "
            "the real Model-1 Design-of-Experiments dataset where Demand was an actual controlled input."
        ),
        "method": (
            "pressure_score, mean_utilization, mean_queue and baseline_mean_output_parts_per_day are "
            f"computed over all {report.n_batches_analyzed} real Model-3 batches - the full population, "
            "not a sample (pass-through stations Blanking/Paint1/Paint2/Quality are shown but excluded "
            "from being 'top station' since every part flows through them by construction). "
            "driver_importance and throughput_sensitivity come from a RandomForest fit on a 50,000-batch "
            "random sample (sampling only applied here, to keep model training fast - plain statistics "
            "above don't need it): driver_importance is feature importance predicting real daily output "
            "(c_TotalProducts) from the contended resources' utilization/queue; throughput_sensitivity is "
            "the partial-dependence output gap between the top station's own P25 and P75 utilization with "
            "every other contended resource held at its dataset-average (isolates that station's marginal "
            "effect from cross-batch demand-day confounding)."
        ),
    }


@router.get("/drift")
def drift(window: int = 200, sigma: float = 3.0):
    alerts = detect_drift(window=window, sigma=sigma)
    return {
        "window": window,
        "sigma": sigma,
        "n_alerts": len(alerts),
        "alerts": [
            {
                "batch_id": a.batch_id,
                "station": a.station,
                "metric": a.metric,
                "value": a.value,
                "control_limit": a.control_limit,
                "direction": a.direction,
            }
            for a in alerts
        ],
    }


@router.get("/stream")
def stream(start: int = 0, count: int = 50):
    """Replays real Model 3 batches in order, `count` at a time, so the
    dashboard can render a continuously-updating feed without inventing any
    values - every row returned is a real recorded batch."""
    df = load_model3()
    end = min(start + count, len(df))
    chunk = df.iloc[start:end]
    util_cols = [c for c in df.columns if c.endswith("_Util")]
    cols = ["batch_id", "c_TotalProducts"] + util_cols
    return {
        "start": start,
        "end": end,
        "total_batches": len(df),
        "rows": chunk[cols].to_dict(orient="records"),
    }


@router.get("/batch/{batch_id}")
def batch_detail(batch_id: int):
    """A single real Model-3 batch's full recorded row - backs the top-bar
    Batch selector's detail view."""
    df = load_model3()
    if batch_id < 0 or batch_id >= len(df):
        return {"error": f"batch_id out of range (0-{len(df) - 1})"}
    row = df.iloc[batch_id]
    util_cols = [c for c in df.columns if c.endswith("_Util")]
    queue_cols = [c for c in df.columns if c.endswith("_Queue")]
    return {
        "batch_id": int(row["batch_id"]),
        "total_products": float(row["c_TotalProducts"]),
        "utilization": {c.replace("_Util", ""): float(row[c]) for c in util_cols},
        "queue": {c.replace("_Queue", ""): float(row[c]) for c in queue_cols},
    }


@router.get("/demand-response")
def demand_response(demand: float | None = None):
    model = get_demand_response_model()
    payload = {
        "empirical_curve": {
            "demand_levels": model.demand_levels,
            "mean_parts_per_hour": model.mean_parts_per_hour,
            "mean_drilling_util": model.mean_drilling_util,
            "mean_milling_util": model.mean_milling_util,
            "mean_assembly_util": model.mean_assembly_util,
            "mean_assembly_wait": model.mean_assembly_wait,
        },
        "method": (
            "GradientBoostingRegressor fit on the real Model-1 Design-of-Experiments dataset "
            "(3000 real Arena replications sweeping Demand 1-20)."
        ),
    }
    if demand is not None:
        payload["prediction_at_demand"] = model.predict(demand)
    return payload
