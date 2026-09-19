import { useRef } from "react";
import type { Detection } from "../api/types";

const CLASS_COLOR: Record<string, string> = {
  crazing: "var(--series-1)",
  inclusion: "var(--series-2)",
  patches: "var(--series-3)",
  pitted_surface: "var(--series-4)",
  "rolled-in_scale": "var(--series-5)",
  scratches: "var(--series-7)",
};

export function BoundingBoxOverlay({
  imageUrl,
  detections,
  imgW,
  imgH,
}: {
  imageUrl: string;
  detections: Detection[];
  imgW: number;
  imgH: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={containerRef} className="relative w-full overflow-hidden rounded-lg border border-white/10 bg-black">
      <img src={imageUrl} alt="Inspected part" className="block w-full" />
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox={`0 0 ${imgW} ${imgH}`}
        preserveAspectRatio="none"
      >
        {detections.map((d, i) => {
          const [x1, y1, x2, y2] = d.box_xyxy;
          const color = d.uncertain ? "var(--status-warning)" : CLASS_COLOR[d.class_name] ?? "var(--series-1)";
          return (
            <g key={i}>
              <rect
                x={x1}
                y={y1}
                width={x2 - x1}
                height={y2 - y1}
                fill="none"
                stroke={color}
                strokeWidth={Math.max(1.5, imgW / 160)}
                strokeDasharray={d.uncertain ? "6 4" : undefined}
                rx={2}
              />
            </g>
          );
        })}
      </svg>
      {/* labels rendered as HTML (not SVG text) so font stays crisp regardless of viewBox scale */}
      {detections.map((d, i) => {
        const [x1, y1] = d.box_xyxy;
        const color = d.uncertain ? "var(--status-warning)" : CLASS_COLOR[d.class_name] ?? "var(--series-1)";
        return (
          <span
            key={i}
            className="absolute rounded px-1.5 py-0.5 text-[10px] font-medium text-black"
            style={{
              left: `${(x1 / imgW) * 100}%`,
              top: `${(y1 / imgH) * 100}%`,
              transform: "translateY(-100%)",
              background: color,
            }}
          >
            {d.uncertain ? "uncertain" : d.class_name} {(d.calibrated_confidence * 100).toFixed(0)}%
          </span>
        );
      })}
    </div>
  );
}
