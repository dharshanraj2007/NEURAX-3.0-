from __future__ import annotations

import asyncio
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routers import agent, correlation, data, economics, process, recommendations, vision

logger = logging.getLogger("uvicorn")

app = FastAPI(
    title="Visual Inspection & Defect Root-Cause Assistant",
    description=(
        "Software-only decision-support API: real defect detection/localization "
        "(trained on the real NEU-DET steel-surface dataset), real bottleneck and "
        "batch-drift analysis (computed live from the organizer's Model 3 DES "
        "dataset), and a documented process-to-quality linkage + profitability "
        "simulator. See GET /api/methodology for the linkage assumptions."
    ),
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(vision.router)
app.include_router(process.router)
app.include_router(economics.router)
app.include_router(correlation.router)
app.include_router(recommendations.router)
app.include_router(data.router)
app.include_router(agent.router)


@app.get("/api/health")
def health():
    return {"status": "ok"}


def _warm_caches() -> None:
    """Pre-computes the expensive, lru_cache'd reports once at startup (each
    involves fitting a real model on the real Model 3 dataset) so the first
    real dashboard request doesn't pay for it - all of these are still
    genuinely computed, just moved earlier rather than mocked."""
    from .services.bottleneck import _full_history_station_stats, compute_bottleneck_report
    from .services.demand_response import get_demand_response_model
    from .services.root_cause import get_root_cause_report

    try:
        logger.info("Warming caches: demand-response model...")
        get_demand_response_model()
        logger.info("Warming caches: bottleneck report...")
        compute_bottleneck_report()
        logger.info("Warming caches: drift control-limit statistics...")
        _full_history_station_stats()
        logger.info("Warming caches: root-cause correlation report...")
        # Bare call - see the long comment in routers/correlation.py on why
        # every "default report" call site must match this exact shape.
        get_root_cause_report()
        logger.info("Cache warm-up complete.")
    except Exception:
        logger.exception("Cache warm-up failed - endpoints will compute on first request instead.")


@app.on_event("startup")
async def on_startup():
    asyncio.get_event_loop().run_in_executor(None, _warm_caches)

    from .services.agent import run_forever

    asyncio.create_task(run_forever())
