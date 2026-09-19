from __future__ import annotations

import random
from pathlib import Path

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import FileResponse

from ..services import vision as vision_service

router = APIRouter(prefix="/api/vision", tags=["vision"])

NEU_CLASSES = ["crazing", "inclusion", "patches", "pitted_surface", "rolled-in_scale", "scratches"]
SAMPLES_DIR = Path(__file__).resolve().parent.parent.parent.parent / "data" / "raw" / "NEU-DET-split" / "val" / "images"


@router.get("/status")
def status():
    return {"model_ready": vision_service.model_is_ready()}


@router.get("/sample-image/{class_name}")
def sample_image(class_name: str):
    """Serves a real example image for the given NEU-DET class from the
    held-out validation split - used for the Defects page drill-down. Picks
    randomly among that class's real val images on each call (not a single
    hardcoded file)."""
    if class_name not in NEU_CLASSES:
        raise HTTPException(status_code=404, detail=f"Unknown class '{class_name}'")
    if not SAMPLES_DIR.exists():
        raise HTTPException(status_code=503, detail="Dataset not prepared yet - run ml/prepare_dataset.py")
    candidates = sorted(SAMPLES_DIR.glob(f"{class_name}_*.jpg"))
    if not candidates:
        raise HTTPException(status_code=404, detail=f"No sample images found for '{class_name}'")
    chosen = random.choice(candidates)
    return FileResponse(chosen, media_type="image/jpeg")


@router.post("/inspect")
async def inspect(file: UploadFile = File(...)):
    if not vision_service.model_is_ready():
        raise HTTPException(
            status_code=503,
            detail="Detector not trained yet - run ml/train_detector.py first. No fallback/mock result is returned.",
        )
    image_bytes = await file.read()
    try:
        result = vision_service.inspect_image(image_bytes)
    except Exception as exc:  # noqa: BLE001 - surface real error to caller
        raise HTTPException(status_code=400, detail=f"Could not run inference: {exc}") from exc

    return {
        "verdict": result.verdict,
        "image_width": result.image_width,
        "image_height": result.image_height,
        "uncertain_threshold_raw_confidence": result.uncertain_threshold,
        "detections": [
            {
                "class_name": d.class_name,
                "raw_confidence": d.raw_confidence,
                "calibrated_confidence": d.calibrated_confidence,
                "box_xyxy": d.box_xyxy,
                "uncertain": d.uncertain,
            }
            for d in result.detections
        ],
    }
