export type MachineStatus = "running" | "warning" | "down";
export type Severity = "normal" | "warning" | "critical";
export type ParamKey = "temperature" | "pressure" | "speed" | "vibration";
export type IncidentStatus = "open" | "acknowledged" | "stopped" | "resolved";

export interface Machine {
  id: string;
  name: string;
  status: MachineStatus;
}

export interface MachineReading {
  machineId: string;
  temperature: number;
  pressure: number;
  speed: number;
  vibration: number;
  recordedAt: string;
}

export interface StandardValue {
  machineId: string;
  parameter: ParamKey | "thickness";
  label: string;
  correctValue: number;
  min: number;
  max: number;
  unit: string;
}

export interface MachineIncident {
  id: string;
  machineId: string;
  parameter: ParamKey;
  label: string;
  expectedMin: number;
  expectedMax: number;
  actualValue: number;
  unit: string;
  severity: "warning" | "critical";
  emergency: boolean;
  status: IncidentStatus;
  recommendedAction: string;
  downtimeMinutes: number;
  costPerMinute: number;
  downtimeStart?: string;
  downtimeEnd?: string;
  date: string;
  acknowledged: boolean;
  maintenanceNotified: boolean;
}

export type ReviewStatus = "auto" | "pending_review" | "approved" | "rejected";

export interface ProductDefect {
  productId: string;
  machineId: string;
  defectType: string;
  targetValue: number;
  actualValue: number;
  unit: string;
  reworkedQuantity: number;
  scrappedQuantity: number;
  recordedAt: string;
  machineParametersAtProduction: {
    temperature: number;
    pressure: number;
    speed: number;
    vibration: number;
  };
  confidence: number;
  location: string;
  reviewStatus: ReviewStatus;
  source: "seed" | "manual";
}

/** Payload for a human-entered defect record (POST /api/product-defects). */
export interface ManualDefectInput {
  machineId: string;
  defectType: string;
  targetValue: number;
  actualValue: number;
  unit: string;
  reworkedQuantity: number;
  scrappedQuantity: number;
  location: string;
  machineParametersAtProduction: {
    temperature: number;
    pressure: number;
    speed: number;
    vibration: number;
  };
}

export interface ProductionPoint {
  time: string;
  production: number;
  good: number;
  defective: number;
}

export interface DefectDistributionEntry {
  category: string;
  units: number;
}

export interface ClassMetric {
  category: string;
  precision: number;
  recall: number;
  f1: number;
  support: number;
}

export interface RobustnessCondition {
  condition: string;
  sampleSize: number;
  accuracy: number;
  note: string;
}

export interface FarFrrPoint {
  threshold: number;
  far: number;
  frr: number;
}

export interface CostConfig {
  downtimeCostPerMinute: number;
  manufacturingCostPerUnit: number;
  reworkCostPerUnit: number;
}
