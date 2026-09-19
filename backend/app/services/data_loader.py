"""
Loads the organizer-provided Discrete-Event Simulation datasets and converts
them to Parquet once for fast repeated access. All numbers downstream are
computed live from these real files - nothing here is a fabricated constant.

Dataset facts (verified by direct inspection of the raw CSVs):
  - Model 1 / Model 2: Design-of-Experiments sweeps. `Demand` is the varied
    input (levels 1-20), each level replicated ~150-180 times. Good for
    fitting a real demand -> throughput/utilization/wait-time response curve.
  - Model 3: `Time_Now` is constant (24) for every one of the 605,621 rows.
    This is NOT a continuous time series - each row is one independent
    24-hour production-day replication (a "batch"). Row order is used here
    only as a synthetic batch index for drift/streaming demos; the values
    themselves are the organizer's real simulated output.
"""
from __future__ import annotations

import functools
from pathlib import Path

import pandas as pd

RAW_ROOT = Path(
    r"C:\Users\dhars\OneDrive\Desktop\LOKI\Manufacturing Data Shared Facility - Discrete-Event Simulation"
    r"\Manufacturing Data Shared Facility - Discrete-Event Simulation"
)
PROCESSED_ROOT = Path(r"C:\Users\dhars\OneDrive\Desktop\LOKI\defect-inspection-system\data\processed")
PROCESSED_ROOT.mkdir(parents=True, exist_ok=True)

MODEL1_CSV = RAW_ROOT / "Model 1" / "Model_1.csv"
MODEL2_CSV = RAW_ROOT / "Model 2" / "Model_2.csv"
MODEL3_CSV = RAW_ROOT / "Model 3" / "Model_3.csv"

MODEL3_PARQUET = PROCESSED_ROOT / "model3.parquet"

# Station -> (utilization columns, queue columns). Taken directly from the
# Model 3 process diagram (Model 3.pdf) and the CSV header.
STATION_GROUPS = {
    "Blanking": {
        "util": ["Blanking_Util"],
        "queue": [
            "Blanking_Queue",
            "Blanking_SKU1_Queue",
            "Blanking_SKU2_Queue",
            "Blanking_SKU3_Queue",
            "Blanking_SKU4_Queue",
        ],
    },
    "Press1": {"util": ["Press1_Util"], "queue": ["Press1_Queue"]},
    "Press2": {"util": ["Press2_Util"], "queue": ["Press2_Queue"]},
    "Press3": {"util": ["Press3_Util"], "queue": ["Press3_Queue"]},
    "Press4": {"util": ["Press4_Util"], "queue": ["Press4_Queue"]},
    "Cell1": {"util": ["Cell1_Util"], "queue": ["Cell1_Queue"]},
    "Cell2": {"util": ["Cell2_Util"], "queue": ["Cell2_Queue"]},
    "Cell3": {"util": ["Cell3_Util"], "queue": ["Cell3_Queue"]},
    "Cell4": {"util": ["Cell4_Util"], "queue": ["Cell4_Queue"]},
    "Paint1": {"util": ["Paint1_Util"], "queue": ["Paint1_Queue"]},
    "Paint2": {"util": ["Paint2_Util"], "queue": ["Paint2_Queue"]},
    "Quality": {"util": ["Quality_Util"], "queue": ["Quality_Queue"]},
    "Forklift": {
        "util": ["Forklift_Util"],
        "queue": ["Forklift_Blanking_Queue", "Forklift_Press_Queue", "Forklift_Assembly_Queue"],
    },
}

SKU_TIME_COLS = {
    sku: {
        "va": f"{sku}_VA_Time",
        "nva": f"{sku}_NVA_Time",
        "transport": f"{sku}_Transport_Time",
        "wait": f"{sku}_Wait_Time",
        "other": f"{sku}_Other_Time",
    }
    for sku in ("SKU1", "SKU2", "SKU3", "SKU4")
}


def ensure_model3_parquet() -> Path:
    """Convert the 300MB Model 3 CSV to Parquet once; reuse afterwards."""
    if MODEL3_PARQUET.exists():
        return MODEL3_PARQUET
    df = pd.read_csv(MODEL3_CSV)
    df.insert(0, "batch_id", range(len(df)))
    df.to_parquet(MODEL3_PARQUET, index=False)
    return MODEL3_PARQUET


@functools.lru_cache(maxsize=1)
def load_model3() -> pd.DataFrame:
    path = ensure_model3_parquet()
    return pd.read_parquet(path)


@functools.lru_cache(maxsize=1)
def load_model1() -> pd.DataFrame:
    df = pd.read_csv(MODEL1_CSV)
    return df.dropna(axis=1, how="all")


@functools.lru_cache(maxsize=1)
def load_model2() -> pd.DataFrame:
    df = pd.read_csv(MODEL2_CSV)
    return df.dropna(axis=1, how="all")
