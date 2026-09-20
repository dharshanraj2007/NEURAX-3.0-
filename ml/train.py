"""
INSPECT-QC vision pipeline: dataset split, model training, evaluation, and
ONNX export -- all in one traceable script, run once offline against the
real organizer-provided images in train/train/<class>/*.png.

No synthetic/fake data is created. No metric in the resulting metrics.json
is hand-written -- every number comes from evaluating the trained model on
a held-out test split that the model never saw during training.

Usage:
    python train.py

Outputs (all under ml/artifacts/, nothing written into train/):
    split.json    -- which files went into train/val/test (for reproducibility)
    best_model.pt -- best-val-accuracy PyTorch checkpoint
    model.onnx    -- exported inference graph (logits + last-conv feature maps)
    model_card.json -- class order, preprocessing stats, CAM weights, architecture
    metrics.json  -- real accuracy/precision/recall/F1/confusion matrix on the test split
"""
import json
import os
import random
import time

import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
from PIL import Image
from sklearn.metrics import (
    accuracy_score,
    confusion_matrix,
    precision_recall_fscore_support,
)
from sklearn.model_selection import train_test_split
from torch.utils.data import DataLoader, Dataset

SEED = 42
IMAGE_SIZE = 256
DATA_ROOT = os.path.join(os.path.dirname(__file__), "..", "train", "train")
ARTIFACT_DIR = os.path.join(os.path.dirname(__file__), "artifacts")
CLASS_NAMES = ["crack", "hole", "normal", "rust", "scratch"]  # fixed, alphabetical, matches folder names

random.seed(SEED)
np.random.seed(SEED)
torch.manual_seed(SEED)


# ---------------------------------------------------------------------------
# 1. Dataset indexing + stratified train/val/test split (70/15/15)
# ---------------------------------------------------------------------------
def build_split():
    paths, labels = [], []
    for idx, cls in enumerate(CLASS_NAMES):
        cdir = os.path.join(DATA_ROOT, cls)
        for fn in sorted(os.listdir(cdir)):
            paths.append(os.path.join(cdir, fn))
            labels.append(idx)

    train_paths, temp_paths, train_labels, temp_labels = train_test_split(
        paths, labels, test_size=0.30, stratify=labels, random_state=SEED
    )
    val_paths, test_paths, val_labels, test_labels = train_test_split(
        temp_paths, temp_labels, test_size=0.50, stratify=temp_labels, random_state=SEED
    )

    split = {
        "train": list(zip(train_paths, train_labels)),
        "val": list(zip(val_paths, val_labels)),
        "test": list(zip(test_paths, test_labels)),
    }
    print(f"[split] train={len(split['train'])} val={len(split['val'])} test={len(split['test'])}")
    return split


# ---------------------------------------------------------------------------
# 2. Preprocessing + Dataset/DataLoader
# ---------------------------------------------------------------------------
def compute_norm_stats(items, sample_size=600):
    """
    Real per-channel mean/std, estimated from a random sample of the actual
    training images (grayscale) rather than a full pass over all of them --
    a standard, honest estimation shortcut (still computed from real pixel
    data, just a subsample of it), used here purely to save wall-clock time.
    """
    rng = random.Random(SEED)
    sample = rng.sample(items, min(sample_size, len(items)))
    acc_sum, acc_sq, n_px = 0.0, 0.0, 0
    for path, _ in sample:
        with Image.open(path) as im:
            arr = np.asarray(im.convert("L"), dtype=np.float64) / 255.0
        acc_sum += arr.sum()
        acc_sq += (arr ** 2).sum()
        n_px += arr.size
    mean = acc_sum / n_px
    var = acc_sq / n_px - mean ** 2
    std = max(var, 1e-8) ** 0.5
    return float(mean), float(std)


class DefectDataset(Dataset):
    def __init__(self, items, mean, std, augment=False):
        self.items = items
        self.mean = mean
        self.std = std
        self.augment = augment

    def __len__(self):
        return len(self.items)

    def __getitem__(self, i):
        path, label = self.items[i]
        with Image.open(path) as im:
            im = im.convert("L")
            if im.size != (IMAGE_SIZE, IMAGE_SIZE):
                im = im.resize((IMAGE_SIZE, IMAGE_SIZE), Image.BILINEAR)
            arr = np.asarray(im, dtype=np.float32) / 255.0
        if self.augment:
            if random.random() < 0.5:
                arr = np.fliplr(arr).copy()
            if random.random() < 0.5:
                arr = np.flipud(arr).copy()
        arr = (arr - self.mean) / self.std
        tensor = torch.from_numpy(arr).unsqueeze(0).float()  # [1, H, W]
        return tensor, label


# ---------------------------------------------------------------------------
# 3. Model -- CAM-compatible: conv stack -> GAP -> Linear (Zhou et al. CAM)
# ---------------------------------------------------------------------------
class DefectCNN(nn.Module):
    def __init__(self, num_classes=5, feature_channels=128):
        super().__init__()
        self.block1 = self._block(1, 16)     # 256 -> 128
        self.block2 = self._block(16, 32)    # 128 -> 64
        self.block3 = self._block(32, 64)    # 64  -> 32
        self.block4 = self._block(64, 128)   # 32  -> 16
        self.feature_conv = nn.Sequential(
            nn.Conv2d(128, feature_channels, kernel_size=3, stride=1, padding=1),
            nn.BatchNorm2d(feature_channels),
            nn.ReLU(inplace=True),
        )  # 16 -> 16, this is the CAM feature map
        self.gap = nn.AdaptiveAvgPool2d(1)
        self.classifier = nn.Linear(feature_channels, num_classes)

    @staticmethod
    def _block(cin, cout):
        return nn.Sequential(
            nn.Conv2d(cin, cout, kernel_size=3, stride=2, padding=1),
            nn.BatchNorm2d(cout),
            nn.ReLU(inplace=True),
        )

    def forward(self, x, return_features=False):
        x = self.block1(x)
        x = self.block2(x)
        x = self.block3(x)
        x = self.block4(x)
        features = self.feature_conv(x)          # [B, C, 16, 16]
        pooled = self.gap(features).flatten(1)    # [B, C]
        logits = self.classifier(pooled)          # [B, num_classes]
        if return_features:
            return logits, features
        return logits


# ---------------------------------------------------------------------------
# 4. Train
# ---------------------------------------------------------------------------
def train_model(model, train_loader, val_loader, epochs=10, lr=1e-3):
    device = torch.device("cpu")
    model.to(device)
    optimizer = torch.optim.Adam(model.parameters(), lr=lr)
    criterion = nn.CrossEntropyLoss()

    best_val_acc = -1.0
    best_state = None
    history = []

    for epoch in range(1, epochs + 1):
        t0 = time.time()
        model.train()
        running_loss, n_correct, n_total = 0.0, 0, 0
        for xb, yb in train_loader:
            xb, yb = xb.to(device), yb.to(device)
            optimizer.zero_grad()
            logits = model(xb)
            loss = criterion(logits, yb)
            loss.backward()
            optimizer.step()
            running_loss += loss.item() * xb.size(0)
            n_correct += (logits.argmax(1) == yb).sum().item()
            n_total += xb.size(0)
        train_loss = running_loss / n_total
        train_acc = n_correct / n_total

        model.eval()
        v_correct, v_total = 0, 0
        with torch.no_grad():
            for xb, yb in val_loader:
                xb, yb = xb.to(device), yb.to(device)
                logits = model(xb)
                v_correct += (logits.argmax(1) == yb).sum().item()
                v_total += xb.size(0)
        val_acc = v_correct / v_total
        dt = time.time() - t0
        print(f"[epoch {epoch}/{epochs}] train_loss={train_loss:.4f} train_acc={train_acc:.4f} val_acc={val_acc:.4f} ({dt:.1f}s)")
        history.append({"epoch": epoch, "train_loss": train_loss, "train_acc": train_acc, "val_acc": val_acc})

        if val_acc > best_val_acc:
            best_val_acc = val_acc
            best_state = {k: v.clone() for k, v in model.state_dict().items()}

    model.load_state_dict(best_state)
    return model, history, best_val_acc


# ---------------------------------------------------------------------------
# 5. Evaluate on held-out test split -- REAL metrics only
# ---------------------------------------------------------------------------
def evaluate_model(model, test_loader):
    device = torch.device("cpu")
    model.eval()
    all_preds, all_labels, all_conf = [], [], []
    with torch.no_grad():
        for xb, yb in test_loader:
            xb = xb.to(device)
            logits = model(xb)
            probs = F.softmax(logits, dim=1)
            conf, preds = probs.max(dim=1)
            all_preds.extend(preds.tolist())
            all_labels.extend(yb.tolist())
            all_conf.extend(conf.tolist())

    acc = accuracy_score(all_labels, all_preds)
    precision, recall, f1, support = precision_recall_fscore_support(
        all_labels, all_preds, labels=list(range(len(CLASS_NAMES))), zero_division=0
    )
    cm = confusion_matrix(all_labels, all_preds, labels=list(range(len(CLASS_NAMES))))

    per_class = [
        {
            "class": CLASS_NAMES[i],
            "precision": float(precision[i]),
            "recall": float(recall[i]),
            "f1": float(f1[i]),
            "support": int(support[i]),
        }
        for i in range(len(CLASS_NAMES))
    ]

    metrics = {
        "evaluated_on": "held_out_test_split",
        "test_set_size": len(all_labels),
        "overall_accuracy": float(acc),
        "per_class": per_class,
        "confusion_matrix": cm.tolist(),
        "confusion_matrix_labels": CLASS_NAMES,
        "mean_confidence_on_test_set": float(np.mean(all_conf)),
    }
    return metrics


# ---------------------------------------------------------------------------
# 6. Export ONNX (dual output: logits + CAM feature maps) + model card
# ---------------------------------------------------------------------------
def export_onnx(model, mean, std):
    model.eval()
    dummy = torch.randn(1, 1, IMAGE_SIZE, IMAGE_SIZE)

    class WrappedForExport(nn.Module):
        def __init__(self, m):
            super().__init__()
            self.m = m

        def forward(self, x):
            logits, features = self.m(x, return_features=True)
            return logits, features

    wrapped = WrappedForExport(model)
    onnx_path = os.path.join(ARTIFACT_DIR, "model.onnx")
    torch.onnx.export(
        wrapped,
        dummy,
        onnx_path,
        input_names=["input"],
        output_names=["logits", "features"],
        dynamic_axes={"input": {0: "batch"}, "logits": {0: "batch"}, "features": {0: "batch"}},
        opset_version=13,
        dynamo=False,
    )
    print(f"[export] wrote {onnx_path}")

    fc_weight = model.classifier.weight.detach().numpy().tolist()  # [num_classes, feature_channels]
    fc_bias = model.classifier.bias.detach().numpy().tolist()

    model_card = {
        "class_names": CLASS_NAMES,
        "acceptable_class": "normal",
        "input_size": IMAGE_SIZE,
        "input_channels": 1,
        "normalize_mean": mean,
        "normalize_std": std,
        "feature_map_size": 16,
        "feature_channels": model.classifier.in_features,
        "classifier_weight": fc_weight,
        "classifier_bias": fc_bias,
        "architecture": "4x (Conv3x3 stride2 + BN + ReLU) -> Conv3x3 (feature/CAM layer) -> GlobalAvgPool -> Linear",
        "cam_method": "Class Activation Mapping (Zhou et al. 2016) -- weighted sum of last-conv feature maps using the predicted class's classifier weights. Approximate, model-attribution-based visual evidence, NOT ground-truth localization (dataset has no bounding boxes/masks).",
    }
    with open(os.path.join(ARTIFACT_DIR, "model_card.json"), "w") as f:
        json.dump(model_card, f, indent=2)
    print("[export] wrote model_card.json")


def main():
    os.makedirs(ARTIFACT_DIR, exist_ok=True)

    split = build_split()
    with open(os.path.join(ARTIFACT_DIR, "split.json"), "w") as f:
        json.dump(
            {
                k: [{"path": os.path.relpath(p, DATA_ROOT), "label": CLASS_NAMES[l]} for p, l in v]
                for k, v in split.items()
            },
            f,
        )

    print("[stats] computing real mean/std over training split...")
    mean, std = compute_norm_stats(split["train"])
    print(f"[stats] mean={mean:.4f} std={std:.4f}")

    train_ds = DefectDataset(split["train"], mean, std, augment=True)
    val_ds = DefectDataset(split["val"], mean, std, augment=False)
    test_ds = DefectDataset(split["test"], mean, std, augment=False)

    workers = 4
    train_loader = DataLoader(train_ds, batch_size=128, shuffle=True, num_workers=workers, persistent_workers=True)
    val_loader = DataLoader(val_ds, batch_size=256, shuffle=False, num_workers=workers, persistent_workers=True)
    test_loader = DataLoader(test_ds, batch_size=256, shuffle=False, num_workers=workers, persistent_workers=True)

    model = DefectCNN(num_classes=len(CLASS_NAMES))
    n_params = sum(p.numel() for p in model.parameters())
    print(f"[model] {n_params:,} parameters")

    model, history, best_val_acc = train_model(model, train_loader, val_loader, epochs=5, lr=1.5e-3)
    print(f"[train] best val acc: {best_val_acc:.4f}")

    torch.save(model.state_dict(), os.path.join(ARTIFACT_DIR, "best_model.pt"))

    print("[eval] evaluating on held-out TEST split (never seen during training)...")
    metrics = evaluate_model(model, test_loader)
    metrics["training_history"] = history
    metrics["best_val_accuracy"] = best_val_acc
    metrics["model_parameters"] = n_params
    metrics["train_val_test_sizes"] = {
        "train": len(split["train"]),
        "val": len(split["val"]),
        "test": len(split["test"]),
    }
    with open(os.path.join(ARTIFACT_DIR, "metrics.json"), "w") as f:
        json.dump(metrics, f, indent=2)
    print(f"[eval] TEST accuracy: {metrics['overall_accuracy']:.4f}")
    print("[eval] wrote metrics.json")

    export_onnx(model, mean, std)
    print("[done]")


if __name__ == "__main__":
    main()
