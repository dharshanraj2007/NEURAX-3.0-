import React from "react";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { RobustnessCondition } from "@/types";
import { ChartTooltip } from "./ChartTooltip";

const COLOR = "#2352c9";
const BASELINE_COLOR = "#0e9488";

export function RobustnessChart({ data }: { data: RobustnessCondition[] }) {
  const chartData = data.map((d) => ({ ...d, pct: Math.round(d.accuracy * 1000) / 10 }));

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 36, left: 4, bottom: 0 }} barCategoryGap="30%">
        <CartesianGrid horizontal={false} stroke="#e4ddc9" strokeDasharray="3 3" />
        <XAxis type="number" domain={[80, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11, fill: "#a39c82" }} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="condition" tick={{ fontSize: 11, fill: "#17160f" }} axisLine={false} tickLine={false} width={230} />
        <Tooltip
          cursor={{ fill: "rgba(20,19,15,0.04)" }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const d = payload[0].payload as RobustnessCondition & { pct: number };
            return (
              <ChartTooltip
                label={d.condition}
                rows={[
                  { name: "Accuracy", value: `${d.pct}%`, color: COLOR },
                  { name: "Sample size", value: d.sampleSize.toLocaleString(), color: COLOR },
                ]}
              />
            );
          }}
        />
        <Bar dataKey="pct" radius={[0, 4, 4, 0]} maxBarSize={18}>
          {chartData.map((d, i) => (
            <Cell key={d.condition} fill={i === 0 ? BASELINE_COLOR : COLOR} />
          ))}
          <LabelList dataKey="pct" position="right" formatter={(v: number) => `${v}%`} style={{ fontSize: 11, fill: "#17160f", fontWeight: 600 }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
