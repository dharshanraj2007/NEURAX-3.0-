import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "../../api/client";
import { useApi } from "../../hooks/useApi";
import { LoadingState } from "../LoadingState";

interface TrendPoint {
  batch_id: number;
  stress_index: number;
  p_defect: number;
}
interface TrendResponse {
  points: TrendPoint[];
  note: string;
}

export function DefectTrendChart() {
  const trend = useApi<TrendResponse>(() => api.get("/api/root-cause/trend?n_points=300"));

  if (trend.loading) return <LoadingState label="Computing trend across real batches..." />;
  if (trend.error || !trend.data) return <p className="text-sm text-[var(--status-critical)]">{trend.error ?? "No data"}</p>;

  const data = trend.data.points.map((p) => ({ batch: p.batch_id, "Defect probability": Number((p.p_defect * 100).toFixed(2)) }));

  return (
    <div>
      <ResponsiveContainer debounce={200} width="100%" height={220}>
        <AreaChart data={data} margin={{ left: 0, right: 12, top: 8, bottom: 0 }}>
          <defs>
            <linearGradient id="defectTrendFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--series-1)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--series-1)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--gridline)" vertical={false} />
          <XAxis
            dataKey="batch"
            tick={{ fill: "var(--text-muted)", fontSize: 10 }}
            axisLine={{ stroke: "var(--baseline)" }}
            tickLine={false}
            label={{ value: "Batch position (recorded order)", position: "insideBottom", offset: -2, fill: "var(--text-muted)", fontSize: 10 }}
          />
          <YAxis
            tick={{ fill: "var(--text-muted)", fontSize: 10 }}
            axisLine={{ stroke: "var(--baseline)" }}
            tickLine={false}
            unit="%"
          />
          <Tooltip
            contentStyle={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
            formatter={(value) => [`${value}%`, "Simulated defect probability"]}
            labelFormatter={(l) => `Batch #${l}`}
          />
          <Area type="monotone" dataKey="Defect probability" stroke="var(--series-1)" strokeWidth={2} fill="url(#defectTrendFill)" />
        </AreaChart>
      </ResponsiveContainer>
      <p className="mt-2 text-[11px] leading-relaxed text-[var(--text-muted)]">{trend.data.note}</p>
    </div>
  );
}
