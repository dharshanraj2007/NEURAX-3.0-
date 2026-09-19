import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { StationPressure } from "../../api/types";

// Magnitude encoding across up to 13 stations -> one sequential hue, not a
// rainbow (dataviz skill: categorical color is for identity, not ranking).
// The top (actionable) station is highlighted; pass-through gates are muted.
export function StationBarChart({ ranking, topStation }: { ranking: StationPressure[]; topStation: string }) {
  const data = [...ranking].sort((a, b) => a.pressure_score - b.pressure_score);

  return (
    <ResponsiveContainer debounce={200} width="100%" height={Math.max(280, data.length * 30)}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
        <CartesianGrid horizontal={false} stroke="var(--gridline)" />
        <XAxis
          type="number"
          domain={[0, 1]}
          tick={{ fill: "var(--text-muted)", fontSize: 11 }}
          axisLine={{ stroke: "var(--baseline)" }}
          tickLine={false}
        />
        <YAxis
          type="category"
          dataKey="station"
          width={90}
          tick={{ fill: "var(--text-secondary)", fontSize: 12 }}
          axisLine={{ stroke: "var(--baseline)" }}
          tickLine={false}
        />
        <Tooltip
          cursor={{ fill: "rgba(255,255,255,0.04)" }}
          contentStyle={{
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            fontSize: 12,
            color: "var(--text-primary)",
          }}
          formatter={(value, name) => [Number(value).toFixed(3), String(name)]}
        />
        <Bar dataKey="pressure_score" name="Pressure score" radius={[0, 4, 4, 0]} maxBarSize={16}>
          {data.map((d) => (
            <Cell
              key={d.station}
              fill={
                d.station === topStation
                  ? "var(--status-serious)"
                  : d.is_pass_through
                    ? "var(--baseline)"
                    : "var(--series-1)"
              }
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
