"""
Autonomous Process Agent.

Runs continuously in the background (started once at app startup - see
main.py's on_startup) and requires no user interaction, no external API and
no LLM: this is the "industry automation" layer sitting on top of the
already-audited real analytics elsewhere in this backend, deciding WHEN a
real signal is worth surfacing rather than computing anything new.

It replays the real Model 3 batch history forward through a cursor (the same
"real rows in recorded order, used as a live feed" pattern /api/process/stream
already uses for the dashboard's live batch ticker) and on every tick:

  1. Checks each newly-replayed real batch against the SAME full-history SPC
     control limits /api/process/drift uses (mean +/- 3 sigma per station,
     computed once over all 605,620 real batches) - not a new threshold.
  2. Recomputes a rolling structural-pressure score (the SAME 0.6*util +
     0.4*normalized-queue formula compute_bottleneck_report uses) over a
     trailing window of real batches ending at the cursor, and raises an
     event only when the rolling top contended station changes - so the feed
     reports *changes*, not a restatement of one static global number.
  3. Attaches a real estimated $/day impact to bottleneck events using the
     same what_if_utilization_change function the Economics page calls
     (default cost assumptions - editable there, never silently treated as
     fact here), and only when the underlying model's predicted direction is
     profit-positive (same guardrail recommendations.py already applies).

Every event's evidence is a real number pulled from a function this codebase
already exposes and stands behind elsewhere; this module's own job is
strictly to decide *when to speak up*, never to invent a figure.
"""
from __future__ import annotations

import asyncio
import itertools
import logging
import time
from dataclasses import dataclass, field

from .bottleneck import PASS_THROUGH_STATIONS, _full_history_station_stats
from .data_loader import STATION_GROUPS, load_model3
from .economics import CostAssumptions, what_if_utilization_change
from .root_cause import get_root_cause_report
from .station_specs import STATION_SPECS

logger = logging.getLogger("uvicorn")

BATCH_STEP = 30            # real batches advanced per tick
TICK_SECONDS = 5.0
ROLLING_WINDOW = 1500       # real batches considered for the rolling pressure signal
MAX_EVENTS = 300
PRESSURE_WATCH_THRESHOLD = 0.6
CRITICAL_THRESHOLD = 0.8

DEFAULT_ASSUMPTIONS = CostAssumptions()

_id_counter = itertools.count(1)


@dataclass
class AgentEvent:
    id: int
    ts: float
    severity: str   # "watch" | "critical"
    kind: str       # "drift" | "bottleneck_shift"
    title: str
    detail: str
    evidence: list[str]
    batch_id: int | None
    dollar_impact_per_day: float | None
    caveat: str | None
    source_endpoint: str


@dataclass
class _AgentState:
    cursor: int = 0
    events: list[AgentEvent] = field(default_factory=list)
    tick_count: int = 0
    started_at: float = field(default_factory=time.time)
    rolling_top_station: str | None = None
    running: bool = False


_state = _AgentState()


def _emit(**kwargs) -> AgentEvent:
    ev = AgentEvent(id=next(_id_counter), ts=time.time(), **kwargs)
    _state.events.append(ev)
    if len(_state.events) > MAX_EVENTS:
        del _state.events[: len(_state.events) - MAX_EVENTS]
    return ev


def _check_batches_for_drift(start: int, end: int) -> list[AgentEvent]:
    if end <= start:
        return []
    df = load_model3()
    window = df.iloc[start:end]
    stats = _full_history_station_stats()
    out = []
    for station, cols in STATION_GROUPS.items():
        mu, sd = stats[station]
        upper, lower = mu + 3 * sd, mu - 3 * sd
        util = window[cols["util"]].mean(axis=1)
        breaches = util[(util > upper) | (util < lower)]
        for idx, value in breaches.items():
            direction = "above" if value > upper else "below"
            limit = upper if direction == "above" else lower
            batch_id = int(df.loc[idx, "batch_id"])
            label = STATION_SPECS[station].label if station in STATION_SPECS else station
            out.append(
                _emit(
                    severity="watch",
                    kind="drift",
                    title=f"Drift at {label} - batch #{batch_id}",
                    detail=(
                        f"Utilization {value * 100:.1f}% is {direction} the 3-sigma control limit "
                        f"({limit * 100:.1f}%), computed from the full 605,620-batch history."
                    ),
                    evidence=[
                        f"Batch #{batch_id} {station} utilization: {value * 100:.1f}%",
                        f"Control limit ({direction}): {limit * 100:.1f}% (mean +/- 3 sigma, full history)",
                    ],
                    batch_id=batch_id,
                    dollar_impact_per_day=None,
                    caveat=None,
                    source_endpoint="/api/process/drift",
                )
            )
    return out


def _rolling_pressure_scores(window_df) -> dict[str, float]:
    means, queues = {}, {}
    for station, cols in STATION_GROUPS.items():
        means[station] = float(window_df[cols["util"]].mean(axis=1).mean())
        queues[station] = float(window_df[cols["queue"]].mean(axis=1).mean())
    qmin, qmax = min(queues.values()), max(queues.values())
    qspan = (qmax - qmin) or 1.0
    return {s: 0.6 * means[s] + 0.4 * ((queues[s] - qmin) / qspan) for s in STATION_GROUPS}


def _check_rolling_bottleneck(new_cursor: int) -> list[AgentEvent]:
    df = load_model3()
    start = max(0, new_cursor - ROLLING_WINDOW)
    window_df = df.iloc[start:new_cursor] if new_cursor > start else df.tail(ROLLING_WINDOW)
    if window_df.empty:
        return []
    scores = _rolling_pressure_scores(window_df)
    contended = {s: v for s, v in scores.items() if s not in PASS_THROUGH_STATIONS}
    if not contended:
        return []
    top_station = max(contended, key=lambda s: contended[s])
    top_score = contended[top_station]

    out = []
    if top_score >= PRESSURE_WATCH_THRESHOLD and top_station != _state.rolling_top_station:
        label = STATION_SPECS[top_station].label if top_station in STATION_SPECS else top_station
        target_util = round(top_score * 0.75, 3)
        dollar_impact = None
        try:
            defect_rate = get_root_cause_report().overall_defect_rate
            scenario = what_if_utilization_change(DEFAULT_ASSUMPTIONS, defect_rate, {top_station: target_util})
            if scenario.profit_delta > 0:
                dollar_impact = scenario.profit_delta
        except Exception:
            logger.exception("Agent: what-if scenario failed, continuing without a $ estimate")

        out.append(
            _emit(
                severity="critical" if top_score >= CRITICAL_THRESHOLD else "watch",
                kind="bottleneck_shift",
                title=f"{label} is now the rolling structural bottleneck",
                detail=(
                    f"Over the last {min(new_cursor, ROLLING_WINDOW):,} real batches, {label} carries the "
                    f"highest structural pressure score ({top_score:.2f} of 1.0) among contended resources."
                ),
                evidence=[
                    f"Rolling pressure score ({label}): {top_score:.2f} (formula: 0.6 x utilization + 0.4 x normalized queue)",
                    f"Window: {min(new_cursor, ROLLING_WINDOW):,} most recent real batches",
                ],
                batch_id=new_cursor - 1,
                dollar_impact_per_day=dollar_impact,
                caveat=(
                    "Model 3's rows are independent same-design daily replications, not a physical time "
                    "series - a rolling-window shift here reflects real sampling variation across recent "
                    "real batches, not necessarily a mechanical trend. See /api/methodology."
                ),
                source_endpoint="/api/process/bottleneck",
            )
        )
    _state.rolling_top_station = top_station
    return out


def tick() -> list[AgentEvent]:
    df = load_model3()
    n = len(df)
    prev = _state.cursor
    new_cursor = prev + BATCH_STEP

    events: list[AgentEvent] = []
    if new_cursor >= n:
        events += _check_batches_for_drift(prev, n)
        new_cursor -= n
        events += _check_batches_for_drift(0, new_cursor)
    else:
        events += _check_batches_for_drift(prev, new_cursor)

    events += _check_rolling_bottleneck(new_cursor)

    _state.cursor = new_cursor
    _state.tick_count += 1
    return events


async def run_forever() -> None:
    _state.running = True
    loop = asyncio.get_event_loop()
    logger.info("Autonomous process agent started (real Model-3 replay, %ss/tick).", TICK_SECONDS)
    while True:
        try:
            await loop.run_in_executor(None, tick)
        except Exception:
            logger.exception("Agent tick failed - will retry next tick.")
        await asyncio.sleep(TICK_SECONDS)


def get_events(since_id: int = 0, limit: int = 50) -> list[AgentEvent]:
    evs = [e for e in _state.events if e.id > since_id]
    return evs[-limit:] if limit else evs


def get_status() -> dict:
    by_severity: dict[str, int] = {}
    for e in _state.events:
        by_severity[e.severity] = by_severity.get(e.severity, 0) + 1
    return {
        "running": _state.running,
        "tick_count": _state.tick_count,
        "tick_seconds": TICK_SECONDS,
        "batch_step": BATCH_STEP,
        "cursor_batch_id": _state.cursor,
        "total_batches": len(load_model3()),
        "uptime_seconds": time.time() - _state.started_at,
        "n_events": len(_state.events),
        "counts_by_severity": by_severity,
        "latest_event_id": _state.events[-1].id if _state.events else 0,
    }
