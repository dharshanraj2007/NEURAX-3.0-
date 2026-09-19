"""
Process-to-quality linkage simulator.

THE PROBLEM THIS FILE SOLVES (stated plainly, also exposed via GET
/api/methodology so it is visible in the product, not hidden in a comment):

The organizer-provided files give two things that were never collected
together: (a) 605,621 real Arena-simulated production-day batches with
station utilization/queue telemetry, and (b) nothing about per-unit
inspection outcomes. Separately, a real public vision dataset (NEU steel
surface-defect images, CC-BY-4.0, Northeastern University) gives real
defect images and labels, but was never recorded on this line at all. No
public dataset on earth pairs "this simulated Arena batch" with "this
photographed defect" - that pairing does not exist to be looked up.

Rather than inventing fake numbers and presenting them as measured fact, we
generate a documented, parameterized, inspectable link: a batch's *station
stress* (real, from Model 3) sets the probability and likely family of a
defect via a domain-reasoned affinity table (steel-forming defect
literature: pitting/scale from press-tooling load, scratches from material
handling, patches from paint-line issues, crazing from forming stress,
inclusion treated as a material-intrinsic baseline independent of the
line). When a defect is "found", an ACTUAL real image of that class is
sampled from the real dataset and pushed through the ACTUAL trained
detector - so the image, the label, and the model's confidence/boxes on
that image are all real and reproducible. Only the *coupling probability*
is a stated modeling assumption, and every parameter governing it is a
named constant in this file, editable, and reported back to the caller.
"""
from __future__ import annotations

import functools
from dataclasses import dataclass

import numpy as np

from .data_loader import STATION_GROUPS, load_model3

NEU_CLASSES = [
    "crazing",
    "inclusion",
    "patches",
    "pitted_surface",
    "rolled-in_scale",
    "scratches",
]

# Documented domain affinity: which stations' stress plausibly drives which
# real defect family, based on the physical mechanism of each defect type.
# Weights are relative, not absolute probabilities.
STATION_DEFECT_AFFINITY: dict[str, dict[str, float]] = {
    "Blanking": {"crazing": 0.6, "rolled-in_scale": 0.4},
    "Press1": {"pitted_surface": 0.5, "rolled-in_scale": 0.3, "patches": 0.2},
    "Press2": {"pitted_surface": 0.5, "rolled-in_scale": 0.3, "patches": 0.2},
    "Press3": {"pitted_surface": 0.5, "rolled-in_scale": 0.3, "patches": 0.2},
    "Press4": {"pitted_surface": 0.5, "rolled-in_scale": 0.3, "patches": 0.2},
    "Cell1": {"scratches": 1.0},
    "Cell2": {"scratches": 1.0},
    "Cell3": {"scratches": 1.0},
    "Cell4": {"scratches": 1.0},
    "Paint1": {"patches": 1.0},
    "Paint2": {"patches": 1.0},
    "Forklift": {"scratches": 1.0},
}

# `inclusion` deliberately has NO station affinity above: it is modeled as a
# raw-material-intrinsic defect, uncorrelated with process stress. This is a
# built-in falsifiability check - the correlation engine (root_cause.py)
# should find near-zero station importance for it, which is the expected,
# honest result rather than a forced correlation.

BASE_DEFECT_RATE = 0.030   # ~3% baseline daily reject rate at typical process stress
STRESS_SENSITIVITY = 3.0   # how strongly ABNORMAL stress amplifies the base rate
INCLUSION_BASE_SHARE = 0.12  # inclusion's constant share of defects, independent of stress
AFFINITY_FLOOR = 0.2       # baseline weight a linked class keeps even at zero anomaly
AFFINITY_GAIN = 4.0        # how strongly anomaly (z-score) tilts class choice
Z_CLIP = 4.0               # cap on standardized station-utilization anomaly


@dataclass
class VirtualInspectionEvent:
    batch_id: int
    stress_index: float
    defect_occurred: bool
    defect_class: str | None
    station_utils: dict[str, float]
    station_z: dict[str, float]


@functools.lru_cache(maxsize=1)
def _station_baseline_stats() -> dict[str, tuple[float, float]]:
    """Mean/std of each station's utilization across the FULL 605,620-batch
    history. Used to turn a batch's raw utilization into a standardized
    anomaly (z-score): defects are driven by a station running ABNORMALLY
    hot for *that* batch, not by its ordinary structural load level (e.g.
    Cell1 sits around 87% on a normal day - that baseline load shouldn't by
    itself make every batch equally likely to produce a scratch; a batch
    where Cell1 spikes well above its own typical range is the meaningful
    signal). This also happens to be what makes the class assignment
    statistically learnable batch-to-batch, instead of collapsing to each
    station's near-constant structural average."""
    from .bottleneck import _station_features  # local import avoids a cycle

    df = load_model3()
    feats = _station_features(df)
    stats = {}
    for station in STATION_GROUPS:
        col = feats[f"{station}__util"]
        stats[station] = (float(col.mean()), float(col.std()) or 1.0)
    return stats


def batch_ordered_defect_probability(n_points: int = 300) -> list[dict]:
    """Deterministic (non-stochastic) simulated defect PROBABILITY for a
    sample of batches taken IN THEIR REAL RECORDED ORDER (not shuffled),
    evenly spaced across all 605,620 real batches. Unlike
    simulate_inspection_events (which draws a random defect_occurred outcome
    per event for training the root-cause classifier), this returns the
    expected probability p_defect directly - real, reproducible, and driven
    entirely by each real batch's own station-stress pattern. This is what
    backs the Overview page's defect-trend chart: it is honestly a trend
    across BATCH POSITION in the dataset, not calendar time (Model 3's rows
    are independent replications, not a time series - see data_loader.py),
    but the underlying stress values driving it are 100% real."""
    from .bottleneck import _station_features

    df = load_model3()
    stats = _station_baseline_stats()
    idx = list(range(0, len(df), max(1, len(df) // n_points)))[:n_points]
    sample = df.iloc[idx]
    feats = _station_features(sample)

    points = []
    for i, batch_id in enumerate(sample["batch_id"]):
        row_feats = feats.iloc[i]
        z_scores = []
        for station in STATION_GROUPS:
            u = float(row_feats[f"{station}__util"])
            mu, sd = stats[station]
            z_scores.append(max(0.0, min(Z_CLIP, (u - mu) / sd)))
        stress_index = sum(z_scores) / len(z_scores)
        p_defect = min(0.95, BASE_DEFECT_RATE * (1 + STRESS_SENSITIVITY * stress_index))
        points.append({"batch_id": int(batch_id), "stress_index": stress_index, "p_defect": p_defect})
    return points


def simulate_inspection_events(n: int = 2000, seed: int = 7) -> list[VirtualInspectionEvent]:
    from .bottleneck import _station_features  # local import avoids a cycle

    df = load_model3()
    stats = _station_baseline_stats()
    rng = np.random.default_rng(seed)
    idx = rng.choice(len(df), size=min(n, len(df)), replace=False)
    sample = df.iloc[idx].reset_index(drop=True)
    feats = _station_features(sample)

    events: list[VirtualInspectionEvent] = []
    for i in range(len(sample)):
        row_feats = feats.iloc[i]
        utils = {station: float(row_feats[f"{station}__util"]) for station in STATION_GROUPS}
        z_scores = {}
        for station, u in utils.items():
            mu, sd = stats[station]
            z_scores[station] = float(np.clip((u - mu) / sd, 0.0, Z_CLIP))
        stress_index = float(np.mean(list(z_scores.values())))

        p_defect = min(0.95, BASE_DEFECT_RATE * (1 + STRESS_SENSITIVITY * stress_index))
        defect_occurred = rng.random() < p_defect

        defect_class = None
        if defect_occurred:
            if rng.random() < INCLUSION_BASE_SHARE:
                defect_class = "inclusion"
            else:
                weights = {c: 1e-6 for c in NEU_CLASSES if c != "inclusion"}
                for station, affinities in STATION_DEFECT_AFFINITY.items():
                    z = z_scores[station]
                    for cls, w in affinities.items():
                        weights[cls] = weights.get(cls, 0) + w * (AFFINITY_FLOOR + AFFINITY_GAIN * z)
                classes = list(weights.keys())
                probs = np.array([weights[c] for c in classes])
                probs = probs / probs.sum()
                defect_class = str(rng.choice(classes, p=probs))

        events.append(
            VirtualInspectionEvent(
                batch_id=int(sample.loc[i, "batch_id"]),
                stress_index=stress_index,
                defect_occurred=defect_occurred,
                defect_class=defect_class,
                station_utils=utils,
                station_z=z_scores,
            )
        )
    return events


METHODOLOGY_TEXT = __doc__
