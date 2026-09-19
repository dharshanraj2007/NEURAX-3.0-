"""
Trains a real YOLOv8n object detector on the real, verified NEU-DET dataset
(see prepare_dataset.py for provenance). This produces genuine learned
weights at ml/weights/best.pt - the backend's vision service loads this
file and performs real forward-pass inference; it never fabricates
detections.

Run:
    ..\.venv\Scripts\python.exe ml\train_detector.py
"""
from pathlib import Path

from ultralytics import YOLO

ROOT = Path(__file__).resolve().parent.parent


def main():
    model = YOLO("yolov8n.pt")  # COCO-pretrained backbone, fine-tuned below
    results = model.train(
        data=str(ROOT / "ml" / "dataset.yaml"),
        epochs=60,
        imgsz=320,
        batch=16,
        patience=15,
        project=str(ROOT / "ml" / "runs"),
        name="neu_det",
        exist_ok=True,
        device="cpu",
        workers=2,
        seed=42,
    )
    metrics = model.val(data=str(ROOT / "ml" / "dataset.yaml"), split="val")
    print("Validation metrics:", metrics.results_dict)

    best = ROOT / "ml" / "runs" / "neu_det" / "weights" / "best.pt"
    target = ROOT / "ml" / "weights" / "best.pt"
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(best.read_bytes())
    print(f"Copied best weights to {target}")


if __name__ == "__main__":
    main()
