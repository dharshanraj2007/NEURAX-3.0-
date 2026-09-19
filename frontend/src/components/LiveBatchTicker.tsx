import { useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import type { StreamResponse } from "../api/types";
import { useAppFilters } from "../context/AppFilters";

// Replays real Model-3 batches in order, advancing the cursor on an
// interval, so the dashboard "updates continuously" without inventing any
// values - every row shown is a real recorded batch from the dataset. Also
// publishes the latest batch id / total count into AppFilters so the
// top-bar "Latest Batch" field reflects the same live position.
export function LiveBatchTicker() {
  const [rows, setRows] = useState<StreamResponse["rows"]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const cursor = useRef(0);
  const [playing, setPlaying] = useState(true);
  const { setLatestBatchId, setTotalBatches } = useAppFilters();

  useEffect(() => {
    let cancelled = false;
    const tick = () => {
      api
        .get<StreamResponse>(`/api/process/stream?start=${cursor.current}&count=1`)
        .then((res) => {
          if (cancelled) return;
          setTotal(res.total_batches);
          setTotalBatches(res.total_batches);
          if (res.rows.length) {
            setRows((prev) => [...res.rows, ...prev].slice(0, 8));
            setLatestBatchId(res.rows[0].batch_id);
            cursor.current = res.end >= res.total_batches ? 0 : res.end;
          }
        })
        .catch(() => void 0);
    };
    tick();
    const id = playing ? setInterval(tick, 1800) : undefined;
    return () => {
      cancelled = true;
      if (id) clearInterval(id);
    };
  }, [playing, setLatestBatchId, setTotalBatches]);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between text-xs text-[var(--text-muted)]">
        <span>{total ? `${total.toLocaleString()} real batches available` : "..."}</span>
        <button
          onClick={() => setPlaying((p) => !p)}
          className="rounded border border-white/15 px-2 py-1 text-[var(--text-secondary)] hover:bg-white/5"
        >
          {playing ? "Pause" : "Resume"}
        </button>
      </div>
      <div className="space-y-1.5">
        {rows.map((r) => (
          <div
            key={r.batch_id}
            className="flex items-center justify-between rounded-md bg-[var(--surface-2)] px-3 py-2 text-xs tabular-nums"
          >
            <span className="text-[var(--text-muted)]">Batch #{r.batch_id}</span>
            <span className="text-[var(--text-secondary)]">
              Output <span className="text-[var(--text-primary)]">{Math.round(r.c_TotalProducts).toLocaleString()}</span>
            </span>
            <span className="text-[var(--text-secondary)]">
              Blanking util <span className="text-[var(--text-primary)]">{(r.Blanking_Util * 100).toFixed(0)}%</span>
            </span>
          </div>
        ))}
        {rows.length === 0 && <p className="text-sm text-[var(--text-muted)]">Waiting for first batch...</p>}
      </div>
    </div>
  );
}
