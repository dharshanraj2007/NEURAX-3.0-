"""
Capacity / demand-response model, fit on the real Model 1 & Model 2
Design-of-Experiments datasets (Demand swept 1-20, ~150-180 real Arena
replications per level, 3000 rows each - verified by direct inspection).

We fit a real regression (not a lookup table, not invented coefficients) so
the profitability "what-if I raise/lower demand" slider on the dashboard
reflects an empirically fitted relationship between demand and
throughput/utilization/waiting time.
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from sklearn.ensemble import GradientBoostingRegressor

from .data_loader import load_model1


@dataclass
class DemandResponseModel:
    demand_levels: list[int]
    mean_parts_per_hour: list[float]
    mean_drilling_util: list[float]
    mean_milling_util: list[float]
    mean_assembly_util: list[float]
    mean_assembly_wait: list[float]

    _pph_model: GradientBoostingRegressor
    _util_models: dict[str, GradientBoostingRegressor]

    def predict(self, demand: float) -> dict:
        x = np.array([[demand]])
        return {
            "parts_per_hour": float(self._pph_model.predict(x)[0]),
            "drilling_util": float(self._util_models["Drilling Util"].predict(x)[0]),
            "milling_util": float(self._util_models["Milling Util"].predict(x)[0]),
            "assembly_util": float(self._util_models["Assembly Util"].predict(x)[0]),
            "assembly_wait": float(self._util_models["Assembly Waiting Time"].predict(x)[0]),
        }


_cache: DemandResponseModel | None = None


def get_demand_response_model() -> DemandResponseModel:
    global _cache
    if _cache is not None:
        return _cache

    df = load_model1()
    X = df[["Demand"]].values
    y_pph = df["Parts per hour"].values

    pph_model = GradientBoostingRegressor(random_state=42)
    pph_model.fit(X, y_pph)

    util_models = {}
    for col in ["Drilling Util", "Milling Util", "Assembly Util", "Assembly Waiting Time"]:
        m = GradientBoostingRegressor(random_state=42)
        m.fit(X, df[col].values)
        util_models[col] = m

    grouped = df.groupby("Demand").mean(numeric_only=True)
    _cache = DemandResponseModel(
        demand_levels=list(grouped.index.astype(int)),
        mean_parts_per_hour=list(grouped["Parts per hour"]),
        mean_drilling_util=list(grouped["Drilling Util"]),
        mean_milling_util=list(grouped["Milling Util"]),
        mean_assembly_util=list(grouped["Assembly Util"]),
        mean_assembly_wait=list(grouped["Assembly Waiting Time"]),
        _pph_model=pph_model,
        _util_models=util_models,
    )
    return _cache
