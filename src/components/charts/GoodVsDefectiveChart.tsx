import React from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { ChartTooltip } from "./ChartTooltip";

const COLORS = { good: "#1e8e5a", defective: "#d1291d" };

export function GoodVsDefectiveChart({
  good,
  defective,
  goodLabel = "Good",
  centerLabel = "Yield",
}: {
  good: number;
  defective: number;
  goodLabel?: string;
  centerLabel?: string;
}) {
  const data = [
    { name: goodLabel, value: good, color: COLORS.good },
    { name: "Defective", value: defective, color: COLORS.defective },
  ];
  const yieldPct = ((good / (good + defective)) * 100).toFixed(1);

  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius={62} outerRadius={90} paddingAngle={2} startAngle={90} endAngle={-270}>
            {data.map((d) => (
              <Cell key={d.name} fill={d.color} stroke="none" />
            ))}
          </Pie>
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0];
              return <ChartTooltip rows={[{ name: p.name as string, value: (p.value as number).toLocaleString(), color: p.payload.color }]} />;
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-2xl font-bold text-ink">{yieldPct}%</div>
        <div className="font-label text-[10px] uppercase tracking-wider text-ink-faint">{centerLabel}</div>
      </div>
      <div className="mt-2 flex items-center justify-center gap-4 text-xs text-ink-muted">
        {data.map((d) => (
          <div key={d.name} className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: d.color }} />
            {d.name} <span className="font-semibold text-ink">{d.value.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
