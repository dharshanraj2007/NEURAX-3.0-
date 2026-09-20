import React, { useEffect, useRef } from "react";

const BG = { r: 236, g: 234, b: 218 }; // matches app's --bg cream
const HOT = { r: 209, g: 41, b: 29 }; // status-critical red, same hue used for single-image CAM overlays

function lerp(a: number, b: number, t: number) {
  return Math.round(a + (b - a) * t);
}

/**
 * Renders a real aggregated Grad-CAM grid (mean attribution over N real
 * held-out images) as a canvas heatmap. Not a photo, not smoothed data --
 * canvas is used purely for crisp rendering of the actual gridSize x
 * gridSize float matrix computed in ml/aggregate_heatmaps.py.
 */
export function AttributionHeatmapGrid({ grid, size = 320 }: { grid: number[][]; size?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rows = grid.length;
    const cols = grid[0]?.length ?? 0;
    canvas.width = size;
    canvas.height = size;
    const cellW = size / cols;
    const cellH = size / rows;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const t = Math.max(0, Math.min(1, grid[r][c]));
        const color = `rgb(${lerp(BG.r, HOT.r, t)}, ${lerp(BG.g, HOT.g, t)}, ${lerp(BG.b, HOT.b, t)})`;
        ctx.fillStyle = color;
        ctx.fillRect(c * cellW, r * cellH, cellW + 0.5, cellH + 0.5);
      }
    }
  }, [grid, size]);

  return <canvas ref={canvasRef} className="rounded-lg border border-border" style={{ width: "100%", height: "auto", aspectRatio: "1 / 1" }} />;
}
