import React from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ClassMetric } from "@/types";
import { ChartTooltip } from "./ChartTooltip";

const COLORS = { precision: "#2352c9", recall: "#0e9488" };

export function PrecisionRecallChart({ data }: { data: ClassMetric[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: 4, bottom: 0 }} barCategoryGap="28%" barGap={4}>
        <CartesianGrid vertical={false} stroke="#e4ddc9" strokeDasharray="3 3" />
        <XAxis dataKey="category" tick={{ fontSize: 11, fill: "#a39c82" }} axisLine={{ stroke: "#e4ddc9" }} tickLine={false} />
        <YAxis
          domain={[0, 1]}
          tickFormatter={(v) => `${Math.round(v * 100)}%`}
          tick={{ fontSize: 11, fill: "#a39c82" }}
          axisLine={false}
          tickLine={false}
          width={42}
        />
        <Tooltip
          cursor={{ fill: "rgba(20,19,15,0.04)" }}
          content={({ active, label, payload }) => {
            if (!active || !payload?.length) return null;
            return (
              <ChartTooltip
                label={String(label)}
                rows={payload.map((p) => ({ name: p.name as string, value: `${((p.value as number) * 100).toFixed(1)}%`, color: p.color as string }))}
              />
            );
          }}
        />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: "#837a5e", paddingTop: 8 }} />
        <Bar dataKey="precision" name="Precision" fill={COLORS.precision} radius={[3, 3, 0, 0]} maxBarSize={26} />
        <Bar dataKey="recall" name="Recall" fill={COLORS.recall} radius={[3, 3, 0, 0]} maxBarSize={26} />
      </BarChart>
    </ResponsiveContainer>
  );
}
