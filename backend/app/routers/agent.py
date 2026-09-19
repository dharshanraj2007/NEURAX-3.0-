from __future__ import annotations

from fastapi import APIRouter

from ..services import agent as agent_service

router = APIRouter(prefix="/api/agent", tags=["agent"])


@router.get("/status")
def status():
    return agent_service.get_status()


@router.get("/events")
def events(since_id: int = 0, limit: int = 50):
    evs = agent_service.get_events(since_id=since_id, limit=limit)
    return {
        "events": [
            {
                "id": e.id,
                "ts": e.ts,
                "severity": e.severity,
                "kind": e.kind,
                "title": e.title,
                "detail": e.detail,
                "evidence": e.evidence,
                "batch_id": e.batch_id,
                "dollar_impact_per_day": e.dollar_impact_per_day,
                "caveat": e.caveat,
                "source_endpoint": e.source_endpoint,
            }
            for e in evs
        ],
        "latest_id": evs[-1].id if evs else since_id,
    }
