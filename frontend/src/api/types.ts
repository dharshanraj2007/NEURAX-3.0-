export interface StationPressure {
  station: string;
  mean_utilization: number;
  mean_queue: number;
  pressure_score: number;
  is_pass_through: boolean;
}

export interface BottleneckReport {
  top_station: string;
  n_batches_analyzed: number;
  baseline_mean_output_parts_per_day: number;
  top_station_headroom_pct: number;
  throughput_sensitivity_parts_per_day: number;
  ranking: StationPressure[];
  driver_importance: Record<string, number>;
  caveat: string;
  method: string;
}

export interface DriftAlert {
  batch_id: number;
  station: string;
  metric: string;
  value: number;
  control_limit: number;
  direction: "above" | "below";
}

export interface DriftReport {
  window: number;
  sigma: number;
  n_alerts: number;
  alerts: DriftAlert[];
}

export interface StreamRow {
  batch_id: number;
  c_TotalProducts: number;
  [key: string]: number;
}

export interface StreamResponse {
  start: number;
  end: number;
  total_batches: number;
  rows: StreamRow[];
}

export interface DemandResponseCurve {
  demand_levels: number[];
  mean_parts_per_hour: number[];
  mean_drilling_util: number[];
  mean_milling_util: number[];
  mean_assembly_util: number[];
  mean_assembly_wait: number[];
}

export interface DemandResponsePayload {
  empirical_curve: DemandResponseCurve;
  method: string;
  prediction_at_demand?: {
    parts_per_hour: number;
    drilling_util: number;
    milling_util: number;
    assembly_util: number;
    assembly_wait: number;
  };
}

export interface Detection {
  class_name: string;
  raw_confidence: number;
  calibrated_confidence: number;
  box_xyxy: [number, number, number, number];
  uncertain: boolean;
}

export interface InspectionResult {
  verdict: "acceptable" | "defective" | "uncertain";
  image_width: number;
  image_height: number;
  uncertain_threshold_raw_confidence: number;
  detections: Detection[];
}

export interface DriverEntry {
  station: string;
  importance: number;
}

export interface RootCauseReport {
  n_events: number;
  overall_defect_rate: number;
  class_counts: Record<string, number>;
  top_drivers_by_class: Record<string, DriverEntry[]>;
  signal_strength_by_class: Record<string, number>;
  roc_auc_by_class: Record<string, number>;
  model_accuracy_cv: number;
  note: string;
}

export interface ProfitabilityResult {
  defect_rate_used: number;
  production_volume_overridden?: boolean;
  baseline_daily_output: number;
  good_parts: number;
  defective_parts: number;
  revenue: number;
  scrap_cost: number;
  operating_cost: number;
  downtime_opportunity_cost: number;
  profit: number;
  margin_pct: number;
}

export interface WhatIfResult {
  defect_rate_used: number;
  baseline_output: number;
  scenario_output: number;
  output_delta: number;
  baseline_profit: number;
  scenario_profit: number;
  profit_delta: number;
  caveat: string;
}

export type ResourceStatus = "normal" | "watch" | "constraint";

export interface StationResource {
  id: string;
  label: string;
  capacity: number;
  cycle_time_desc: string;
  mean_utilization: number | null;
  mean_queue: number | null;
  pressure_score: number | null;
  is_pass_through: boolean | null;
  status: ResourceStatus;
}

export interface ProcessStage {
  stage: string;
  resources: StationResource[];
}

export interface SharedResource {
  id: string;
  label: string;
  role: string;
  cycle_time_desc: string;
  mean_utilization: number;
  mean_queue: number;
  pressure_score: number;
  status: ResourceStatus;
}

export interface StationsResponse {
  stages: ProcessStage[];
  shared_resources: SharedResource[];
  top_station: string;
  n_batches_analyzed: number;
}

export interface Recommendation {
  id: string;
  title: string;
  reason: string;
  evidence: string[];
  confidence_pct: number;
  expected_effect: Record<string, number>;
  simulate_endpoint: string;
  simulate_payload: Record<string, unknown>;
}

export interface RecommendationsResponse {
  recommendations: Recommendation[];
  disclaimer: string;
}

export interface DataSource {
  id: string;
  name: string;
  category: string;
  ready: boolean;
  count: number | null;
  detail: string;
}

export interface DataHealthResponse {
  sources: DataSource[];
}

export type AgentSeverity = "watch" | "critical";

export interface AgentEvent {
  id: number;
  ts: number;
  severity: AgentSeverity;
  kind: "drift" | "bottleneck_shift";
  title: string;
  detail: string;
  evidence: string[];
  batch_id: number | null;
  dollar_impact_per_day: number | null;
  caveat: string | null;
  source_endpoint: string;
}

export interface AgentEventsResponse {
  events: AgentEvent[];
  latest_id: number;
}

export interface AgentStatus {
  running: boolean;
  tick_count: number;
  tick_seconds: number;
  batch_step: number;
  cursor_batch_id: number;
  total_batches: number;
  uptime_seconds: number;
  n_events: number;
  counts_by_severity: Record<string, number>;
  latest_event_id: number;
}
