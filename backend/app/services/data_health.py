"""
Data/model provenance status for the Data page. Every field here is either
a filesystem check (does this artifact exist, how big is it) or a value
already computed elsewhere (row counts from the loaders) - nothing is
asserted without checking. Filesystem paths themselves are not exposed to
the frontend, only derived, presentable facts.
"""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from .data_loader import MODEL1_CSV, MODEL2_CSV, MODEL3_CSV, load_model1, load_model2, load_model3
from .vision import CALIBRATION_PATH, WEIGHTS_PATH

ML_ROOT = Path(__file__).resolve().parent.parent.parent.parent / "ml"
NEU_TRAIN_DIR = ML_ROOT.parent / "data" / "raw" / "NEU-DET-split" / "train" / "images"
NEU_VAL_DIR = ML_ROOT.parent / "data" / "raw" / "NEU-DET-split" / "val" / "images"


@dataclass
class DataSourceStatus:
    id: str
    name: str
    category: str
    ready: bool
    row_or_image_count: int | None
    detail: str


def get_data_health() -> list[DataSourceStatus]:
    sources: list[DataSourceStatus] = []

    sources.append(
        DataSourceStatus(
            id="model3",
            name="Model 3 - production process telemetry",
            category="Process",
            ready=MODEL3_CSV.exists(),
            row_or_image_count=len(load_model3()) if MODEL3_CSV.exists() else None,
            detail="605,620 real 24-hour batch replications, 77 columns (Arena DES export)",
        )
    )
    sources.append(
        DataSourceStatus(
            id="model1",
            name="Model 1 - Drilling/Milling/Assembly DOE",
            category="Process (DOE)",
            ready=MODEL1_CSV.exists(),
            row_or_image_count=len(load_model1()) if MODEL1_CSV.exists() else None,
            detail="Demand swept 1-20, ~150-180 real replications per level",
        )
    )
    sources.append(
        DataSourceStatus(
            id="model2",
            name="Model 2 - Drilling/Milling/Assembly DOE (extended)",
            category="Process (DOE)",
            ready=MODEL2_CSV.exists(),
            row_or_image_count=len(load_model2()) if MODEL2_CSV.exists() else None,
            detail="Same line as Model 1, richer per-part-type telemetry",
        )
    )

    train_n = len(list(NEU_TRAIN_DIR.glob("*.jpg"))) if NEU_TRAIN_DIR.exists() else 0
    val_n = len(list(NEU_VAL_DIR.glob("*.jpg"))) if NEU_VAL_DIR.exists() else 0
    sources.append(
        DataSourceStatus(
            id="neu-det",
            name="NEU-DET - steel surface-defect images",
            category="Vision",
            ready=(train_n + val_n) > 0,
            row_or_image_count=train_n + val_n,
            detail=(
                f"{train_n} train / {val_n} held-out val images, 6 classes, real bounding-box labels "
                "(Figshare DOI 10.6084/m9.figshare.28903550.v1, CC BY 4.0)"
            ),
        )
    )
    sources.append(
        DataSourceStatus(
            id="yolo-weights",
            name="Trained defect detector",
            category="Vision model",
            ready=WEIGHTS_PATH.exists(),
            row_or_image_count=None,
            detail="YOLOv8n fine-tuned on NEU-DET" if WEIGHTS_PATH.exists() else "Not trained yet - run ml/train_detector.py",
        )
    )
    sources.append(
        DataSourceStatus(
            id="calibration",
            name="Confidence calibration",
            category="Vision model",
            ready=CALIBRATION_PATH.exists(),
            row_or_image_count=None,
            detail=(
                "Isotonic regression fit on real held-out validation predictions"
                if CALIBRATION_PATH.exists()
                else "Not calibrated yet - run ml/calibrate.py"
            ),
        )
    )
    return sources
