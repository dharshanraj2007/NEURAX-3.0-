import React from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell, LabelList } from "recharts";
import type { DefectDistributionEntry } from "@/types";
import { ChartTooltip } from "./ChartTooltip";

const CAT_COLORS = ["#c1440e", "#c98a0e", "#0e9488", "#2f5fd6", "#b23a6b"];

export function DefectDistributionChart({ data }: { data: DefectDistributionEntry[] }) {
  const sorted = [...data].sort((a, b) => b.units - a.units);
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={sorted} layout="vertical" margin={{ top: 4, right: 28, left: 4, bottom: 0 }} barCategoryGap="28%">
        <CartesianGrid horizontal={false} stroke="#e4ddc9" strokeDasharray="3 3" />
        <XAxis type="number" tick={{ fontSize: 11, fill: "#a39c82" }} axisLine={false} tickLine={false} />
        <YAxis
          type="category"
          dataKey="category"
          tick={{ fontSize: 12, fill: "#17160f", fontWeight: 500 }}
          axisLine={false}
          tickLine={false}
          width={90}
        />
        <Tooltip
          cursor={{ fill: "rgba(20,19,15,0.04)" }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const d = payload[0].payload as DefectDistributionEntry;
            const idx = sorted.findIndex((s) => s.category === d.category);
            return <ChartTooltip label={d.category} rows={[{ name: "Units", value: d.units, color: CAT_COLORS[idx % CAT_COLORS.length] }]} />;
          }}
        />
        <Bar dataKey="units" radius={[0, 4, 4, 0]} maxBarSize={22}>
          {sorted.map((d, i) => (
            <Cell key={d.category} fill={CAT_COLORS[i % CAT_COLORS.length]} />
          ))}
          <LabelList dataKey="units" position="right" style={{ fontSize: 11, fill: "#17160f", fontWeight: 600 }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
