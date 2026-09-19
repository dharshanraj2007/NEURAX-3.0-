"""
Post-hoc confidence calibration for the trained detector, using the real
held-out validation images (never seen during training - see
prepare_dataset.py for the stratified split).

Method (documented, reproducible):
  1. Run the trained model on every real validation image.
  2. For each predicted box, mark it "correct" if it overlaps (IoU >= 0.5) a
     real ground-truth box of the SAME class in that image, else "incorrect"
     (standard detection-matching logic, computed here directly - no
     external eval library needed for this).
  3. Fit an isotonic regression from raw YOLO confidence -> empirical
     probability-correct. This is a real statistical fit on real held-out
     predictions, not an assumed curve.
  4. Pick the "uncertain" threshold as the raw confidence below which
     calibrated precision drops under 0.5 (worse than a coin flip on being
     right) - detections below it are shown to the operator as "uncertain /
     needs review" instead of being forced into a class.

Outputs:
  ml/weights/calibration.joblib   (fitted IsotonicRegression)
  ml/weights/calibration_summary.json (human-readable reliability table + threshold)
"""
import json
from pathlib import Path

import numpy as np
from sklearn.isotonic import IsotonicRegression
from ultralytics import YOLO

ROOT = Path(__file__).resolve().parent.parent
VAL_IMAGES = ROOT / "data" / "raw" / "NEU-DET-split" / "val" / "images"
VAL_LABELS = ROOT / "data" / "raw" / "NEU-DET-split" / "val" / "labels"
WEIGHTS = ROOT / "ml" / "weights" / "best.pt"


def yolo_to_xyxy(cx, cy, w, h, img_w, img_h):
    x1 = (cx - w / 2) * img_w
    y1 = (cy - h / 2) * img_h
    x2 = (cx + w / 2) * img_w
    y2 = (cy + h / 2) * img_h
    return x1, y1, x2, y2


def iou(a, b):
    ax1, ay1, ax2, ay2 = a
    bx1, by1, bx2, by2 = b
    ix1, iy1 = max(ax1, bx1), max(ay1, by1)
    ix2, iy2 = min(ax2, bx2), min(ay2, by2)
    iw, ih = max(0.0, ix2 - ix1), max(0.0, iy2 - iy1)
    inter = iw * ih
    area_a = max(0.0, ax2 - ax1) * max(0.0, ay2 - ay1)
    area_b = max(0.0, bx2 - bx1) * max(0.0, by2 - by1)
    union = area_a + area_b - inter
    return inter / union if union > 0 else 0.0


def load_gt(label_path: Path, img_w: int, img_h: int):
    boxes = []
    if not label_path.exists():
        return boxes
    for line in label_path.read_text().strip().splitlines():
        parts = line.split()
        cls = int(parts[0])
        cx, cy, w, h = map(float, parts[1:5])
        boxes.append((cls, yolo_to_xyxy(cx, cy, w, h, img_w, img_h)))
    return boxes


def main():
    model = YOLO(str(WEIGHTS))
    confidences, corrects = [], []

    img_paths = sorted(VAL_IMAGES.glob("*.jpg"))
    for img_path in img_paths:
        result = model.predict(source=str(img_path), imgsz=320, conf=0.05, verbose=False)[0]
        img_h, img_w = result.orig_shape
        gt_boxes = load_gt(VAL_LABELS / (img_path.stem + ".txt"), img_w, img_h)
        gt_used = [False] * len(gt_boxes)

        for box in result.boxes:
            pred_cls = int(box.cls.item())
            pred_conf = float(box.conf.item())
            pred_xyxy = tuple(box.xyxy[0].tolist())

            matched = False
            for gi, (gt_cls, gt_xyxy) in enumerate(gt_boxes):
                if gt_used[gi] or gt_cls != pred_cls:
                    continue
                if iou(pred_xyxy, gt_xyxy) >= 0.5:
                    gt_used[gi] = True
                    matched = True
                    break
            confidences.append(pred_conf)
            corrects.append(1 if matched else 0)

    confidences = np.array(confidences)
    corrects = np.array(corrects)
    print(f"Collected {len(confidences)} predictions on {len(img_paths)} val images "
          f"(empirical precision @ raw conf: {corrects.mean():.3f})")

    iso = IsotonicRegression(out_of_bounds="clip", y_min=0.0, y_max=1.0)
    iso.fit(confidences, corrects)

    # reliability table for the report
    bins = np.linspace(0, 1, 11)
    table = []
    for lo, hi in zip(bins[:-1], bins[1:]):
        mask = (confidences >= lo) & (confidences < hi)
        n = int(mask.sum())
        acc = float(corrects[mask].mean()) if n else None
        table.append({"bin": [float(lo), float(hi)], "n": n, "empirical_precision": acc})

    # pick uncertain-threshold: lowest raw confidence where calibrated prob >= 0.5
    grid = np.linspace(0, 1, 201)
    calibrated = iso.predict(grid)
    above_half = grid[calibrated >= 0.5]
    uncertain_threshold = float(above_half.min()) if len(above_half) else 0.5

    import joblib
    weights_dir = ROOT / "ml" / "weights"
    weights_dir.mkdir(parents=True, exist_ok=True)
    joblib.dump(iso, weights_dir / "calibration.joblib")
    (weights_dir / "calibration_summary.json").write_text(
        json.dumps(
            {
                "n_predictions": int(len(confidences)),
                "n_val_images": len(img_paths),
                "empirical_precision_raw": float(corrects.mean()),
                "reliability_table": table,
                "uncertain_threshold_raw_confidence": uncertain_threshold,
            },
            indent=2,
        )
    )
    print(f"Uncertain threshold (raw conf) = {uncertain_threshold:.3f}")
    print(f"Saved calibration to {weights_dir}")


if __name__ == "__main__":
    main()
