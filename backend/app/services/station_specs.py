"""
Per-station process specification - real constants transcribed directly from
the organizer-provided `Model 3.pdf` process documentation (not measured in
the CSV, not invented). These are the designed processing-time distributions
Arena used to generate the telemetry; the CSV never logs "cycle time"
directly, so this is the authentic source for it. Kept separate from
`bottleneck.py` (which is all measured-from-CSV) so the two provenances are
never conflated.
"""
from __future__ import annotations

from dataclasses import dataclass


@dataclass
class StationSpec:
    label: str
    stage: str  # which of the 5 named process stages this resource belongs to
    capacity: int
    cycle_time_desc: str  # human-readable, from the PDF
    cycle_time_seconds_mean: float  # point estimate used for display math


STATION_SPECS: dict[str, StationSpec] = {
    "Blanking": StationSpec(
        "Blanking", "Blanking", 1,
        "NORM(900, 30) + 2 x current demand (seconds)", 900,
    ),
    "Press1": StationSpec("Press 1", "Pressing", 2, "NORM(5, 0.1) seconds", 5),
    "Press2": StationSpec("Press 2", "Pressing", 2, "NORM(5, 0.1) seconds", 5),
    "Press3": StationSpec("Press 3", "Pressing", 2, "NORM(5, 0.1) seconds", 5),
    "Press4": StationSpec("Press 4", "Pressing", 2, "NORM(5, 0.1) seconds", 5),
    "Cell1": StationSpec("Assembly Cell 1", "Assembly", 8, "SKU1: NORM(25,0.1)s / SKU2,4: NORM(15-17,0.1)s", 20),
    "Cell2": StationSpec("Assembly Cell 2", "Assembly", 2, "SKU2: NORM(15,0.1)s / SKU4: NORM(17,0.1)s", 16),
    "Cell3": StationSpec("Assembly Cell 3", "Assembly", 2, "SKU2: NORM(15,0.1)s / SKU3: NORM(23,0.1)s", 19),
    "Cell4": StationSpec("Assembly Cell 4", "Assembly", 4, "SKU3: NORM(23,0.1)s / SKU4: NORM(17,0.1)s", 20),
    "Paint1": StationSpec("Paint Conveyor 1", "Paint", 1, "Constant 5,400 seconds (conveyor)", 5400),
    "Paint2": StationSpec("Paint Conveyor 2", "Paint", 1, "Constant 5,400 seconds (conveyor)", 5400),
    "Quality": StationSpec("Quality Check", "QC", 1, "TRIA(50, 55, 60) seconds", 55),
    "Forklift": StationSpec(
        "Forklift", "Material Handling", 1,
        "180s (Blanking->Press), 180s (Press->Assembly), 60s (Assembly->Paint) + NORM(300,30)s load/unload each leg",
        300,
    ),
}

# Which assembly cells each SKU is eligible for, per Model 3.pdf's documented
# routing logic (real, transcribed from the process spec, not inferred).
SKU_CELL_ROUTING: dict[str, list[str]] = {
    "SKU1": ["Cell1"],
    "SKU2": ["Cell1", "Cell2", "Cell3"],
    "SKU3": ["Cell3", "Cell4"],
    "SKU4": ["Cell1", "Cell2", "Cell4"],
}

PROCESS_STAGES = ["Blanking", "Pressing", "Assembly", "Paint", "QC"]

STAGE_TO_STATIONS: dict[str, list[str]] = {
    "Blanking": ["Blanking"],
    "Pressing": ["Press1", "Press2", "Press3", "Press4"],
    "Assembly": ["Cell1", "Cell2", "Cell3", "Cell4"],
    "Paint": ["Paint1", "Paint2"],
    "QC": ["Quality"],
}
