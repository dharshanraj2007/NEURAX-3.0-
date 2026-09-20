import React from "react";
import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { FarFrrPoint } from "@/types";
import { ChartTooltip } from "./ChartTooltip";

const COLORS = { far: "#d1291d", frr: "#2352c9" };

export function FarFrrChart({ data, currentThreshold }: { data: FarFrrPoint[]; currentThreshold: number }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 4, right: 12, left: 4, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="#e4ddc9" strokeDasharray="3 3" />
        <XAxis
          dataKey="threshold"
          tickFormatter={(v) => `${Math.round(v * 100)}%`}
          tick={{ fontSize: 11, fill: "#a39c82" }}
          axisLine={{ stroke: "#e4ddc9" }}
          tickLine={false}
        />
        <YAxis tickFormatter={(v) => `${Math.round(v * 100)}%`} tick={{ fontSize: 11, fill: "#a39c82" }} axisLine={false} tickLine={false} width={40} />
        <Tooltip
          content={({ active, label, payload }) => {
            if (!active || !payload?.length) return null;
            return (
              <ChartTooltip
                label={`Threshold ${Math.round((label as number) * 100)}%`}
                rows={payload.map((p) => ({ name: p.name as string, value: `${((p.value as number) * 100).toFixed(1)}%`, color: p.color as string }))}
              />
            );
          }}
        />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: "#837a5e", paddingTop: 8 }} />
        <ReferenceLine x={currentThreshold} stroke="#17160f" strokeDasharray="4 4" />
        <Line type="monotone" dataKey="far" name="False Accept Rate" stroke={COLORS.far} strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="frr" name="False Reject Rate" stroke={COLORS.frr} strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
