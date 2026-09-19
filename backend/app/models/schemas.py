from __future__ import annotations

from pydantic import BaseModel


class CostAssumptionsIn(BaseModel):
    unit_price: float = 45.0
    scrap_cost_per_unit: float = 18.0
    operating_cost_per_hour: float = 900.0
    defect_rate: float | None = None  # if None, derived from the root-cause simulation
    production_volume: float | None = None  # if None, uses the real measured mean daily output


class WhatIfIn(BaseModel):
    unit_price: float = 45.0
    scrap_cost_per_unit: float = 18.0
    operating_cost_per_hour: float = 900.0
    defect_rate: float | None = None
    station_overrides: dict[str, float] = {}


class DemandQueryIn(BaseModel):
    demand: float
