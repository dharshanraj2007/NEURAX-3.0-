import React from "react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, Legend } from "recharts";
import type { ProductionPoint } from "@/types";
import { ChartTooltip } from "./ChartTooltip";

const COLORS = {
  production: "#2352c9",
  good: "#1e8e5a",
  defective: "#d1291d",
};

export function ProductionTrendChart({ data }: { data: ProductionPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 4, right: 8, left: 4, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="#e4ddc9" strokeDasharray="3 3" />
        <XAxis
          dataKey="time"
          tick={{ fontSize: 11, fill: "#a39c82" }}
          axisLine={{ stroke: "#e4ddc9" }}
          tickLine={false}
        />
        <YAxis tick={{ fontSize: 11, fill: "#a39c82" }} axisLine={false} tickLine={false} width={36} />
        <Tooltip
          content={({ active, label, payload }) => {
            if (!active || !payload?.length) return null;
            return (
              <ChartTooltip
                label={String(label)}
                rows={payload.map((p) => ({
                  name: p.name as string,
                  value: p.value as number,
                  color: p.color as string,
                }))}
              />
            );
          }}
        />
        <Legend
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: 12, color: "#837a5e", paddingTop: 8 }}
        />
        <Line type="monotone" dataKey="production" name="Production" stroke={COLORS.production} strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="good" name="Good" stroke={COLORS.good} strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="defective" name="Defective" stroke={COLORS.defective} strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
