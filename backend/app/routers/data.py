from __future__ import annotations

from fastapi import APIRouter

from ..services.data_health import get_data_health

router = APIRouter(prefix="/api/data", tags=["data"])


@router.get("/health")
def health():
    sources = get_data_health()
    return {
        "sources": [
            {
                "id": s.id,
                "name": s.name,
                "category": s.category,
                "ready": s.ready,
                "count": s.row_or_image_count,
                "detail": s.detail,
            }
            for s in sources
        ]
    }
