import React from "react";

const BASE = { r: 35, g: 82, b: 201 }; // status-info blue

export function ConfusionMatrix({ labels, matrix }: { labels: string[]; matrix: number[][] }) {
  const max = Math.max(...matrix.flat());

  return (
    <div className="overflow-x-auto">
      <div className="inline-grid" style={{ gridTemplateColumns: `120px repeat(${labels.length}, 76px)` }}>
        <div />
        {labels.map((l) => (
          <div key={l} className="px-1 pb-2 text-center text-[10px] font-medium leading-tight text-ink-faint">
            {l}
          </div>
        ))}

        {matrix.map((row, i) => (
          <React.Fragment key={labels[i]}>
            <div className="flex items-center pr-2 text-xs font-semibold text-ink">{labels[i]}</div>
            {row.map((count, j) => {
              const ratio = max > 0 ? count / max : 0;
              const isDiagonal = i === j;
              const bg = `rgba(${BASE.r}, ${BASE.g}, ${BASE.b}, ${(0.06 + ratio * 0.85).toFixed(2)})`;
              return (
                <div
                  key={j}
                  className="m-[1.5px] flex h-11 items-center justify-center rounded-md text-xs font-semibold"
                  style={{
                    backgroundColor: bg,
                    color: ratio > 0.55 ? "#fff" : "#17160f",
                    boxShadow: isDiagonal ? "inset 0 0 0 2px #1e8e5a" : undefined,
                  }}
                  title={`Actual ${labels[i]} → Predicted ${labels[j]}: ${count}`}
                >
                  {count}
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-4 text-xs text-ink-muted">
        <div className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm" style={{ boxShadow: "inset 0 0 0 2px #1e8e5a", backgroundColor: "rgba(35,82,201,0.5)" }} />
          Correct (diagonal)
        </div>
        <span>Rows = actual class · Columns = predicted class</span>
      </div>
    </div>
  );
}
