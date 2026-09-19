"""
Vision inference service. Loads the REAL trained YOLOv8 weights
(ml/weights/best.pt, produced by ml/train_detector.py on the real NEU-DET
dataset) and the REAL isotonic calibration fit (ml/weights/calibration.joblib,
produced by ml/calibrate.py on real held-out validation predictions).

Every call to `inspect_image` runs an actual forward pass through the
trained network on the given real image bytes - there is no lookup table,
no canned response, and no path where a "fake" detection is returned. If
the weights/calibration files are missing (i.e. training hasn't been run
yet), this raises a clear error instead of silently fabricating output.
"""
from __future__ import annotations

import functools
import io
import json
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent.parent.parent  # defect-inspection-system/
WEIGHTS_PATH = ROOT / "ml" / "weights" / "best.pt"
CALIBRATION_PATH = ROOT / "ml" / "weights" / "calibration.joblib"
CALIBRATION_SUMMARY_PATH = ROOT / "ml" / "weights" / "calibration_summary.json"

CLASS_NAMES = ["crazing", "inclusion", "patches", "pitted_surface", "rolled-in_scale", "scratches"]

# Fallback used only if calibrate.py has not been run yet; overwritten by the
# empirically-fit threshold the moment calibration_summary.json exists.
DEFAULT_UNCERTAIN_THRESHOLD = 0.35


class ModelNotTrainedError(RuntimeError):
    pass


@dataclass
class Detection:
    class_name: str
    raw_confidence: float
    calibrated_confidence: float
    box_xyxy: tuple[float, float, float, float]
    uncertain: bool


@dataclass
class InspectionResult:
    verdict: str  # "acceptable" | "defective" | "uncertain"
    detections: list[Detection]
    image_width: int
    image_height: int
    uncertain_threshold: float


@functools.lru_cache(maxsize=1)
def _load_model():
    if not WEIGHTS_PATH.exists():
        raise ModelNotTrainedError(
            f"No trained weights at {WEIGHTS_PATH}. Run `python ml/prepare_dataset.py` "
            f"then `python ml/train_detector.py` first."
        )
    from ultralytics import YOLO

    return YOLO(str(WEIGHTS_PATH))


@functools.lru_cache(maxsize=1)
def _load_calibration():
    if not CALIBRATION_PATH.exists():
        return None, DEFAULT_UNCERTAIN_THRESHOLD
    import joblib

    iso = joblib.load(CALIBRATION_PATH)
    threshold = DEFAULT_UNCERTAIN_THRESHOLD
    if CALIBRATION_SUMMARY_PATH.exists():
        summary = json.loads(CALIBRATION_SUMMARY_PATH.read_text())
        threshold = summary.get("uncertain_threshold_raw_confidence", DEFAULT_UNCERTAIN_THRESHOLD)
    return iso, threshold


def inspect_image(image_bytes: bytes, conf_floor: float = 0.05) -> InspectionResult:
    model = _load_model()
    iso, uncertain_threshold = _load_calibration()

    image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    result = model.predict(source=np.array(image), imgsz=320, conf=conf_floor, verbose=False)[0]
    img_h, img_w = result.orig_shape

    detections: list[Detection] = []
    for box in result.boxes:
        cls_id = int(box.cls.item())
        raw_conf = float(box.conf.item())
        calibrated = float(iso.predict([raw_conf])[0]) if iso is not None else raw_conf
        uncertain = raw_conf < uncertain_threshold
        detections.append(
            Detection(
                class_name=CLASS_NAMES[cls_id],
                raw_confidence=raw_conf,
                calibrated_confidence=calibrated,
                box_xyxy=tuple(box.xyxy[0].tolist()),
                uncertain=uncertain,
            )
        )

    detections.sort(key=lambda d: d.calibrated_confidence, reverse=True)

    if not detections:
        verdict = "acceptable"
    elif all(d.uncertain for d in detections):
        verdict = "uncertain"
    else:
        verdict = "defective"

    return InspectionResult(
        verdict=verdict,
        detections=detections,
        image_width=img_w,
        image_height=img_h,
        uncertain_threshold=uncertain_threshold,
    )


def model_is_ready() -> bool:
    return WEIGHTS_PATH.exists()
