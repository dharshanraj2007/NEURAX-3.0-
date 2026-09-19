"""
Builds a proper stratified train/val split of the real NEU-DET dataset
(downloaded from Figshare DOI 10.6084/m9.figshare.28903550.v1, CC BY 4.0,
md5 19af5a1250d8ab0cb0828d31ee2b349d) and writes an Ultralytics dataset.yaml.

Why re-split: the archive ships with only 30 validation images total (5 per
class), which is too small to report a trustworthy validation metric. All
1800 real images + their real YOLO-format bounding-box labels are pooled
and re-split 80/20, stratified per class, with a fixed seed for
reproducibility. No image content or label is synthesized - this script
only moves/copies real files that were already downloaded and verified.
"""
import random
import shutil
from collections import defaultdict
from pathlib import Path

random.seed(42)

ROOT = Path(__file__).resolve().parent.parent
RAW_DIR = ROOT / "data" / "raw" / "NEU-CLS"
SPLIT_DIR = ROOT / "data" / "raw" / "NEU-DET-split"

CLASSES = ["crazing", "inclusion", "patches", "pitted_surface", "rolled-in_scale", "scratches"]


def collect_pairs():
    pairs = []
    for sub in ["train/train", "valid/valid"]:
        img_dir = RAW_DIR / sub / "images"
        lbl_dir = RAW_DIR / sub / "labels"
        for img_path in img_dir.glob("*.jpg"):
            lbl_path = lbl_dir / (img_path.stem + ".txt")
            if lbl_path.exists():
                pairs.append((img_path, lbl_path))
    return pairs


def class_of(img_path: Path) -> str:
    stem = img_path.stem
    for c in CLASSES:
        if stem.startswith(c + "_"):
            return c
    raise ValueError(f"Unrecognized class for {img_path}")


def main():
    pairs = collect_pairs()
    by_class = defaultdict(list)
    for img_path, lbl_path in pairs:
        by_class[class_of(img_path)].append((img_path, lbl_path))

    if SPLIT_DIR.exists():
        shutil.rmtree(SPLIT_DIR)

    for split in ["train", "val"]:
        (SPLIT_DIR / split / "images").mkdir(parents=True, exist_ok=True)
        (SPLIT_DIR / split / "labels").mkdir(parents=True, exist_ok=True)

    total_train, total_val = 0, 0
    for cls, items in by_class.items():
        random.shuffle(items)
        n_val = max(1, round(len(items) * 0.2))
        val_items = items[:n_val]
        train_items = items[n_val:]
        total_train += len(train_items)
        total_val += len(val_items)
        for split, group in [("train", train_items), ("val", val_items)]:
            for img_path, lbl_path in group:
                shutil.copy2(img_path, SPLIT_DIR / split / "images" / img_path.name)
                shutil.copy2(lbl_path, SPLIT_DIR / split / "labels" / lbl_path.name)
        print(f"{cls:16s} train={len(train_items):3d} val={len(val_items):3d}")

    print(f"TOTAL train={total_train} val={total_val}")

    yaml_content = f"""\
path: {SPLIT_DIR.as_posix()}
train: train/images
val: val/images

names:
  0: crazing
  1: inclusion
  2: patches
  3: pitted_surface
  4: rolled-in_scale
  5: scratches
"""
    out_path = ROOT / "ml" / "dataset.yaml"
    out_path.write_text(yaml_content, encoding="utf-8")
    print(f"Wrote {out_path}")


if __name__ == "__main__":
    main()
