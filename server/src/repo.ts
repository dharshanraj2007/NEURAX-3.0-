import { db, getKv, setKv } from "./db.js";
import type {
  ClassMetric,
  CostConfig,
  DefectDistributionEntry,
  FarFrrPoint,
  Machine,
  MachineIncident,
  MachineReading,
  ManualDefectInput,
  ProductDefect,
  ProductionPoint,
  RobustnessCondition,
  StandardValue,
} from "./types.js";

export function getMachines(): Machine[] {
  return db.prepare("SELECT id, name, status FROM machines ORDER BY id").all() as Machine[];
}

export function setMachineStatus(id: string, status: Machine["status"]) {
  db.prepare("UPDATE machines SET status = ? WHERE id = ?").run(status, id);
}

export function getReadings(): MachineReading[] {
  const rows = db.prepare("SELECT machine_id, temperature, pressure, speed, vibration, recorded_at FROM readings").all() as any[];
  return rows.map((r) => ({
    machineId: r.machine_id,
    temperature: r.temperature,
    pressure: r.pressure,
    speed: r.speed,
    vibration: r.vibration,
    recordedAt: r.recorded_at,
  }));
}

export function getStandardValues(): StandardValue[] {
  const rows = db.prepare("SELECT machine_id, parameter, label, correct_value, min, max, unit FROM standard_values").all() as any[];
  return rows.map((r) => ({
    machineId: r.machine_id,
    parameter: r.parameter,
    label: r.label,
    correctValue: r.correct_value,
    min: r.min,
    max: r.max,
    unit: r.unit,
  }));
}

export function updateStandardValue(
  machineId: string,
  parameter: string,
  patch: { correctValue: number; min: number; max: number; unit: string }
): StandardValue | undefined {
  db.prepare("UPDATE standard_values SET correct_value = ?, min = ?, max = ?, unit = ? WHERE machine_id = ? AND parameter = ?").run(
    patch.correctValue,
    patch.min,
    patch.max,
    patch.unit,
    machineId,
    parameter
  );
  return getStandardValues().find((s) => s.machineId === machineId && s.parameter === parameter);
}

function mapIncidentRow(r: any): MachineIncident {
  return {
    id: r.id,
    machineId: r.machine_id,
    parameter: r.parameter,
    label: r.label,
    expectedMin: r.expected_min,
    expectedMax: r.expected_max,
    actualValue: r.actual_value,
    unit: r.unit,
    severity: r.severity,
    emergency: !!r.emergency,
    status: r.status,
    recommendedAction: r.recommended_action,
    downtimeMinutes: r.downtime_minutes,
    costPerMinute: r.cost_per_minute,
    downtimeStart: r.downtime_start ?? undefined,
    downtimeEnd: r.downtime_end ?? undefined,
    date: r.date,
    acknowledged: !!r.acknowledged,
    maintenanceNotified: !!r.maintenance_notified,
  };
}

export function getIncidents(): MachineIncident[] {
  const rows = db.prepare("SELECT * FROM incidents ORDER BY date DESC, id").all() as any[];
  return rows.map(mapIncidentRow);
}

export function getIncidentById(id: string): MachineIncident | undefined {
  const row = db.prepare("SELECT * FROM incidents WHERE id = ?").get(id) as any;
  return row ? mapIncidentRow(row) : undefined;
}

export function patchIncident(id: string, patch: Partial<MachineIncident>): MachineIncident | undefined {
  const existing = getIncidentById(id);
  if (!existing) return undefined;
  const merged = { ...existing, ...patch };
  db.prepare(
    `UPDATE incidents SET status = ?, acknowledged = ?, maintenance_notified = ?, cost_per_minute = ?, downtime_start = ?, downtime_end = ? WHERE id = ?`
  ).run(
    merged.status,
    merged.acknowledged ? 1 : 0,
    merged.maintenanceNotified ? 1 : 0,
    merged.costPerMinute,
    merged.downtimeStart ?? null,
    merged.downtimeEnd ?? null,
    id
  );
  return getIncidentById(id);
}

export function getProductDefects(): ProductDefect[] {
  const rows = db.prepare("SELECT * FROM product_defects ORDER BY product_id").all() as any[];
  return rows.map((r) => ({
    productId: r.product_id,
    machineId: r.machine_id,
    defectType: r.defect_type,
    targetValue: r.target_value,
    actualValue: r.actual_value,
    unit: r.unit,
    reworkedQuantity: r.reworked_quantity,
    scrappedQuantity: r.scrapped_quantity,
    recordedAt: r.recorded_at,
    machineParametersAtProduction: {
      temperature: r.temperature,
      pressure: r.pressure,
      speed: r.speed,
      vibration: r.vibration,
    },
    confidence: r.confidence,
    location: r.location,
    reviewStatus: r.review_status,
    source: r.source,
  }));
}

export function setReviewStatus(productId: string, decision: "approved" | "rejected"): ProductDefect | undefined {
  db.prepare("UPDATE product_defects SET review_status = ? WHERE product_id = ?").run(decision, productId);
  return getProductDefects().find((d) => d.productId === productId);
}

/**
 * A human-entered defect record. Confidence is 1 (directly observed, no
 * model uncertainty involved) and review_status is 'auto' -- a person
 * typed these numbers in, so there is nothing for another human to review.
 * It persists exactly like a seeded/inferred record and immediately
 * participates in the same root-cause / pattern-matching evidence logic.
 */
export function createProductDefect(input: ManualDefectInput): ProductDefect {
  const productId = `MANUAL-${Date.now().toString(36).toUpperCase()}`;
  const now = new Date();
  const recordedAt = `Today · ${now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;

  db.prepare(
    `INSERT INTO product_defects
      (product_id, machine_id, defect_type, target_value, actual_value, unit, reworked_quantity, scrapped_quantity, recorded_at, temperature, pressure, speed, vibration, confidence, location, review_status, source)
     VALUES (@productId, @machineId, @defectType, @targetValue, @actualValue, @unit, @reworkedQuantity, @scrappedQuantity, @recordedAt, @temperature, @pressure, @speed, @vibration, @confidence, @location, @reviewStatus, @source)`
  ).run({
    productId,
    machineId: input.machineId,
    defectType: input.defectType,
    targetValue: input.targetValue,
    actualValue: input.actualValue,
    unit: input.unit,
    reworkedQuantity: input.reworkedQuantity,
    scrappedQuantity: input.scrappedQuantity,
    recordedAt,
    temperature: input.machineParametersAtProduction.temperature,
    pressure: input.machineParametersAtProduction.pressure,
    speed: input.machineParametersAtProduction.speed,
    vibration: input.machineParametersAtProduction.vibration,
    confidence: 1,
    location: input.location,
    reviewStatus: "auto",
    source: "manual",
  });

  return getProductDefects().find((d) => d.productId === productId)!;
}

export function getProductionTrend(): ProductionPoint[] {
  return db.prepare("SELECT time, production, good, defective FROM production_points ORDER BY time").all() as ProductionPoint[];
}

export function getDefectDistribution(): DefectDistributionEntry[] {
  return db.prepare("SELECT category, units FROM defect_distribution").all() as DefectDistributionEntry[];
}

export function getClassMetrics(): ClassMetric[] {
  return db.prepare("SELECT category, precision, recall, f1, support FROM class_metrics").all() as ClassMetric[];
}

export function getModelMetrics() {
  return {
    classMetrics: getClassMetrics(),
    confusionLabels: getKv<string[]>("confusion_labels"),
    confusionMatrix: getKv<number[][]>("confusion_matrix"),
    robustnessConditions: getKv<RobustnessCondition[]>("robustness_conditions"),
    farFrrCurve: getKv<FarFrrPoint[]>("far_frr_curve"),
  };
}

export function getCostConfig(): CostConfig {
  return getKv<CostConfig>("cost_config");
}

export function setCostConfig(config: CostConfig) {
  setKv("cost_config", config);
}

export function getHeatmap() {
  return {
    hours: getKv<string[]>("heatmap_hours"),
    rows: getKv<Record<string, Array<{ severity: string; note?: string }>>>("heatmap_rows"),
  };
}

export function getBootstrap() {
  return {
    machines: getMachines(),
    readings: getReadings(),
    standardValues: getStandardValues(),
    incidents: getIncidents(),
    productDefects: getProductDefects(),
    production: {
      trend: getProductionTrend(),
      defectDistribution: getDefectDistribution(),
    },
    modelMetrics: getModelMetrics(),
    heatmap: getHeatmap(),
    costConfig: getCostConfig(),
  };
}
