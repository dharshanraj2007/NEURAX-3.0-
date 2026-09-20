"""
Real Grad-CAM aggregation over the actual held-out test split.

Uses the already-trained checkpoint (ml/artifacts/best_model.pt) -- no
retraining. For every one of the 1,800 real test images (the same split
used for the reported test-accuracy metrics, never seen during training):

  1. Run the real forward pass -> predicted class + confidence.
  2. Compute TRUE Grad-CAM (Selvaraju et al. 2017): backprop the predicted
     class's logit to the last conv feature map, global-average-pool the
     gradients into per-channel weights, ReLU the weighted sum of feature
     maps. This is gradient-based attribution, not the cheaper
     classifier-weight-only CAM shortcut.
  3. Resize the 16x16 attribution map to a common 32x32 grid.

Then aggregate (mean) the per-image maps into:
  - one "all defects" map (images predicted as anything other than normal)
  - one map per defect class actually predicted (crack/hole/rust/scratch),
    only if the test split contains at least one real image predicted as
    that class

No bounding boxes or segmentation masks exist in the dataset, so every
value here is model attribution over real images, not ground-truth
localization. Output: ml/artifacts/heatmaps.json (read by the backend).
"""
import json
import os

import numpy as np
import torch
import torch.nn.functional as F
from PIL import Image

from train import DefectCNN, CLASS_NAMES, DATA_ROOT, ARTIFACT_DIR, IMAGE_SIZE

GRID = 32
TOP_K_REPRESENTATIVE = 8

# Must match server/src/vision.ts exactly -- same thresholds, same logic, so
# this aggregate count is directly comparable to what the live single-image
# endpoint would flag.
LOW_CONFIDENCE_THRESHOLD = 0.5
MARGIN_THRESHOLD = 0.15


def uncertainty_state(probs_sorted_desc):
    top1, top2 = probs_sorted_desc[0], probs_sorted_desc[1]
    if top1 < LOW_CONFIDENCE_THRESHOLD:
        return "potentially_novel"
    if (top1 - top2) < MARGIN_THRESHOLD:
        return "uncertain"
    return "confident"


def load_model():
    model = DefectCNN(num_classes=len(CLASS_NAMES))
    state = torch.load(os.path.join(ARTIFACT_DIR, "best_model.pt"), map_location="cpu")
    model.load_state_dict(state)
    model.eval()
    return model


def load_image_tensor(rel_path, mean, std):
    full_path = os.path.join(DATA_ROOT, rel_path)
    with Image.open(full_path) as im:
        im = im.convert("L")
        if im.size != (IMAGE_SIZE, IMAGE_SIZE):
            im = im.resize((IMAGE_SIZE, IMAGE_SIZE), Image.BILINEAR)
        arr = np.asarray(im, dtype=np.float32) / 255.0
    arr = (arr - mean) / std
    return torch.from_numpy(arr).unsqueeze(0).unsqueeze(0).float()  # [1,1,H,W]


def grad_cam(model, x, class_idx):
    """True Grad-CAM: backprop to the last conv feature map's activations."""
    logits, features = model(x, return_features=True)
    features.retain_grad()
    model.zero_grad()
    score = logits[0, class_idx]
    score.backward()

    grads = features.grad[0]  # [C, H, W]
    weights = grads.mean(dim=(1, 2))  # [C] -- global-average-pooled gradients
    cam = torch.einsum("c,chw->hw", weights, features[0].detach())
    cam = F.relu(cam)
    cam_max = cam.max()
    if cam_max > 0:
        cam = cam / cam_max
    cam_resized = F.interpolate(cam.unsqueeze(0).unsqueeze(0), size=(GRID, GRID), mode="bilinear", align_corners=False)
    return cam_resized[0, 0].detach().numpy(), F.softmax(logits, dim=1)[0].detach().numpy()


def macro_region(grid_2d):
    """Which coarse 3x3 macro-cell of the grid has the highest mean activation."""
    h, w = grid_2d.shape
    rows = ["top", "middle", "bottom"]
    cols = ["left", "center", "right"]
    best_val, best_label = -1.0, "center"
    for ri in range(3):
        r0, r1 = int(ri * h / 3), int((ri + 1) * h / 3)
        for ci in range(3):
            c0, c1 = int(ci * w / 3), int((ci + 1) * w / 3)
            block = grid_2d[r0:r1, c0:c1]
            val = float(block.mean())
            if val > best_val:
                best_val = val
                best_label = f"{rows[ri]}-{cols[ci]}"
    return best_label


def build_threshold_curve(per_image, thresholds):
    """
    Real what-if: sweep the confidence threshold required for auto-accept
    and measure, from the actual 1,800 held-out predictions, how much
    coverage (share auto-accepted) and accuracy-among-accepted change.
    This is the one real, data-supported "what-if" lever in this project --
    there is no process-parameter dataset to simulate against.
    """
    n = len(per_image)
    curve = []
    for t in thresholds:
        covered = [p for p in per_image if p["confidence"] >= t]
        correct_covered = sum(1 for p in covered if p["correct"])
        curve.append(
            {
                "threshold": t,
                "coveragePct": len(covered) / n,
                "imagesAboveThreshold": len(covered),
                "imagesBelowThreshold": n - len(covered),
                "accuracyAmongCovered": (correct_covered / len(covered)) if covered else None,
            }
        )
    return curve


def build_confusion_insights(per_image):
    """
    Real, computed from the actual true/predicted labels of the 1,800 test
    images: for each true class that had misclassifications, which other
    class it was most often confused with, and how often. This is
    model-level ambiguity evidence -- not a manufacturing root cause, since
    no process/production data exists to support that kind of claim.
    """
    from collections import Counter

    insights = []
    for true_cls in CLASS_NAMES:
        true_items = [p for p in per_image if p["trueLabel"] == true_cls]
        wrong = [p["predictedClass"] for p in true_items if p["predictedClass"] != true_cls]
        if not wrong:
            continue
        top_pred, count = Counter(wrong).most_common(1)[0]
        insights.append(
            {
                "trueClass": true_cls,
                "confusedWith": top_pred,
                "count": count,
                "totalTrueSamples": len(true_items),
                "confusionRate": count / len(true_items),
            }
        )
    insights.sort(key=lambda x: x["count"], reverse=True)
    return insights


def main():
    with open(os.path.join(ARTIFACT_DIR, "split.json")) as f:
        split = json.load(f)
    with open(os.path.join(ARTIFACT_DIR, "model_card.json")) as f:
        card = json.load(f)

    mean, std = card["normalize_mean"], card["normalize_std"]
    model = load_model()

    test_items = split["test"]
    print(f"[heatmaps] running real Grad-CAM over {len(test_items)} held-out test images...")

    per_image = []  # {path, trueLabel, predictedClass, confidence, correct, cam(32x32 list)}
    for i, item in enumerate(test_items):
        rel_path = item["path"].replace("\\", "/")
        x = load_image_tensor(rel_path, mean, std)
        # need grad on the forward pass -> don't wrap in no_grad
        logits_probe = model(x)
        predicted_idx = int(logits_probe.argmax(dim=1).item())
        cam, probs = grad_cam(model, x, predicted_idx)
        sorted_probs = sorted(probs.tolist(), reverse=True)
        per_image.append(
            {
                "path": rel_path,
                "trueLabel": item["label"],
                "predictedClass": CLASS_NAMES[predicted_idx],
                "confidence": float(probs[predicted_idx]),
                "correct": item["label"] == CLASS_NAMES[predicted_idx],
                "cam": cam,
                "uncertaintyState": uncertainty_state(sorted_probs),
            }
        )
        if (i + 1) % 300 == 0:
            print(f"[heatmaps] {i + 1}/{len(test_items)} done")

    images_analyzed = len(per_image)
    acceptable_class = card["acceptable_class"]
    defective = [p for p in per_image if p["predictedClass"] != acceptable_class]
    acceptable = [p for p in per_image if p["predictedClass"] == acceptable_class]

    per_class_counts = {c: 0 for c in CLASS_NAMES}
    per_class_confidence_sum = {c: 0.0 for c in CLASS_NAMES}
    for p in per_image:
        per_class_counts[p["predictedClass"]] += 1
        per_class_confidence_sum[p["predictedClass"]] += p["confidence"]
    per_class_mean_confidence = {
        c: (per_class_confidence_sum[c] / per_class_counts[c] if per_class_counts[c] > 0 else None) for c in CLASS_NAMES
    }

    defect_class_counts = {c: n for c, n in per_class_counts.items() if c != acceptable_class}
    dominant_defect = max(defect_class_counts, key=defect_class_counts.get) if any(defect_class_counts.values()) else None

    def build_group(items, label):
        if not items:
            return None
        stack = np.stack([p["cam"] for p in items], axis=0)  # [N, 32, 32]
        grid = stack.mean(axis=0)
        ranked = sorted(items, key=lambda p: p["confidence"], reverse=True)[:TOP_K_REPRESENTATIVE]
        return {
            "label": label,
            "count": len(items),
            "grid": grid.round(4).tolist(),
            "peakRegion": macro_region(grid),
            "meanConfidence": float(np.mean([p["confidence"] for p in items])),
            "representativeImages": [
                {
                    "path": p["path"],
                    "trueLabel": p["trueLabel"],
                    "predictedClass": p["predictedClass"],
                    "confidence": round(p["confidence"], 4),
                    "correct": p["correct"],
                }
                for p in ranked
            ],
        }

    aggregate = {"all_defects": build_group(defective, "All Defects")}
    for cls in CLASS_NAMES:
        group = [p for p in per_image if p["predictedClass"] == cls]
        aggregate[cls] = build_group(group, cls)

    confident_count = sum(1 for p in per_image if p["uncertaintyState"] == "confident")
    uncertain_count = sum(1 for p in per_image if p["uncertaintyState"] == "uncertain")
    potentially_novel_count = sum(1 for p in per_image if p["uncertaintyState"] == "potentially_novel")

    threshold_sweep = [0.50, 0.55, 0.60, 0.65, 0.70, 0.75, 0.80, 0.85, 0.90, 0.95, 0.99]
    threshold_analysis = build_threshold_curve(per_image, threshold_sweep)
    confusion_insights = build_confusion_insights(per_image)

    output = {
        "gridSize": GRID,
        "testSetSize": images_analyzed,
        "imagesAnalyzed": images_analyzed,
        "defectiveImages": len(defective),
        "acceptableImages": len(acceptable),
        "perClassCounts": per_class_counts,
        "perClassMeanConfidence": per_class_mean_confidence,
        "overallMeanConfidence": float(np.mean([p["confidence"] for p in per_image])),
        "dominantDefectClass": dominant_defect,
        "acceptableClass": acceptable_class,
        "confidentCount": confident_count,
        "uncertainCount": uncertain_count,
        "potentiallyNovelCount": potentially_novel_count,
        "manualReviewCount": uncertain_count + potentially_novel_count,
        "uncertaintyThresholds": {"lowConfidence": LOW_CONFIDENCE_THRESHOLD, "margin": MARGIN_THRESHOLD},
        "gradCamCoverage": images_analyzed,
        "thresholdAnalysis": threshold_analysis,
        "confusionInsights": confusion_insights,
        "aggregate": aggregate,
        "gradCamMethod": (
            "True Grad-CAM (Selvaraju et al. 2017): channel weights are the "
            "global-average-pooled gradients of the predicted class's logit "
            "with respect to the last conv layer's feature maps, ReLU'd "
            "weighted sum, computed via PyTorch autograd. Not ground-truth "
            "localization -- the dataset has no bounding boxes or segmentation "
            "masks -- this is model attribution over real held-out test images."
        ),
        "evaluatedOn": "held_out_test_split (same 1,800 images used for the reported test-accuracy metrics)",
    }

    out_path = os.path.join(ARTIFACT_DIR, "heatmaps.json")
    with open(out_path, "w") as f:
        json.dump(output, f)
    print(f"[heatmaps] wrote {out_path}")
    print(f"[heatmaps] analyzed={images_analyzed} defective={len(defective)} acceptable={len(acceptable)} dominant={dominant_defect}")


if __name__ == "__main__":
    main()
