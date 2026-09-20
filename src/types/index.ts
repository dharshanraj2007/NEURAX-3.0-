export type MachineStatus = "running" | "warning" | "down";
export type Severity = "normal" | "warning" | "critical";
export type ProductSeverity = "low" | "medium" | "high" | "critical";

export type ParamKey = "temperature" | "pressure" | "speed" | "vibration";

export interface Machine {
  id: string;
  name: string;
  status: MachineStatus;
}

/** Live sensor readings for a machine, as they stand right now. */
export interface MachineReading {
  machineId: string;
  temperature: number;
  pressure: number;
  speed: number;
  vibration: number;
  recordedAt: string;
}

/** Reference / expected operating window for one parameter on one machine. Editable on the Standard Values page. */
export interface StandardValue {
  machineId: string;
  parameter: ParamKey | "thickness";
  label: string;
  correctValue: number;
  min: number;
  max: number;
  unit: string;
}

export type IncidentStatus = "open" | "acknowledged" | "stopped" | "resolved";

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
  /** Display date bucket for the incident history table. */
  date: "Today" | "Yesterday" | string;
  acknowledged?: boolean;
  maintenanceNotified?: boolean;
}

export interface MachineParamSnapshot {
  temperature: number;
  pressure: number;
  speed: number;
  vibration: number;
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
  machineParametersAtProduction: MachineParamSnapshot;
  /** Classifier confidence for this defect call, 0-1. */
  confidence: number;
  /** Where along the strip the defect was localized. */
  location: string;
  /**
   * "auto": confidence was high enough to accept the call outright.
   * "pending_review": low confidence or a novel/out-of-distribution
   * pattern -- the model couldn't tell, so a human must decide before this
   * counts as a confirmed defect anywhere in the app.
   * "approved" / "rejected": the human's decision.
   */
  reviewStatus: ReviewStatus;
  /** "seed": part of the shift's mock dataset. "manual": entered directly by a user on this page. */
  source: "seed" | "manual";
}

/** Payload for POST /api/product-defects -- a human-entered defect record. */
export interface ManualDefectInput {
  machineId: string;
  defectType: string;
  targetValue: number;
  actualValue: number;
  unit: string;
  reworkedQuantity: number;
  scrappedQuantity: number;
  location: string;
  machineParametersAtProduction: MachineParamSnapshot;
}

export interface DefectDistributionEntry {
  category: string;
  units: number;
}

export interface ProductionPoint {
  time: string;
  production: number;
  good: number;
  defective: number;
}

export interface CostConfig {
  downtimeCostPerMinute: number;
  manufacturingCostPerUnit: number;
  reworkCostPerUnit: number;
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

export interface ModelMetrics {
  classMetrics: ClassMetric[];
  confusionLabels: string[];
  confusionMatrix: number[][];
  robustnessConditions: RobustnessCondition[];
  farFrrCurve: FarFrrPoint[];
}

export interface HeatmapCell {
  severity: Severity;
  note?: string;
}

export interface Bootstrap {
  machines: Machine[];
  readings: MachineReading[];
  standardValues: StandardValue[];
  incidents: MachineIncident[];
  productDefects: ProductDefect[];
  production: { trend: ProductionPoint[]; defectDistribution: DefectDistributionEntry[] };
  modelMetrics: ModelMetrics;
  heatmap: { hours: string[]; rows: Record<string, HeatmapCell[]> };
  costConfig: CostConfig;
}

// --- Real vision model (trained on organizer train/ images) ---------------

export type QualityStatus = "ACCEPTABLE" | "DEFECTIVE" | "UNCERTAIN" | "POTENTIALLY_NOVEL";
export type UncertaintyState = "confident" | "uncertain" | "potentially_novel";

export interface VisionResult {
  qualityStatus: QualityStatus;
  defectClass: string;
  confidence: number;
  probabilities: Record<string, number>;
  uncertaintyState: UncertaintyState;
  uncertaintyReason: string;
  heatmapDataUrl: string;
  originalDataUrl: string;
  camMethod: string;
}

export interface VisionPerClassMetric {
  class: string;
  precision: number;
  recall: number;
  f1: number;
  support: number;
}

export interface VisionMetrics {
  evaluated_on: string;
  test_set_size: number;
  overall_accuracy: number;
  per_class: VisionPerClassMetric[];
  confusion_matrix: number[][];
  confusion_matrix_labels: string[];
  mean_confidence_on_test_set: number;
  best_val_accuracy: number;
  model_parameters: number;
  train_val_test_sizes: { train: number; val: number; test: number };
}

export interface ModelCard {
  class_names: string[];
  acceptable_class: string;
  input_size: number;
  architecture: string;
  cam_method: string;
}

export interface ModelInfo {
  ready: boolean;
  loadError: string | null;
  modelCard: ModelCard | null;
  metrics: VisionMetrics | null;
  metricsAvailable: boolean;
}

// --- Real Grad-CAM aggregate heatmap (ml/aggregate_heatmaps.py) ----------

export interface RepresentativeImage {
  path: string;
  trueLabel: string;
  predictedClass: string;
  confidence: number;
  correct: boolean;
}

export interface HeatmapGroup {
  label: string;
  count: number;
  grid: number[][];
  peakRegion: string;
  meanConfidence: number;
  representativeImages: RepresentativeImage[];
}

export interface ThresholdPoint {
  threshold: number;
  coveragePct: number;
  imagesAboveThreshold: number;
  imagesBelowThreshold: number;
  accuracyAmongCovered: number | null;
}

export interface ConfusionInsight {
  trueClass: string;
  confusedWith: string;
  count: number;
  totalTrueSamples: number;
  confusionRate: number;
}

export interface AggregateHeatmap {
  gridSize: number;
  testSetSize: number;
  imagesAnalyzed: number;
  defectiveImages: number;
  acceptableImages: number;
  perClassCounts: Record<string, number>;
  perClassMeanConfidence: Record<string, number | null>;
  overallMeanConfidence: number;
  dominantDefectClass: string | null;
  acceptableClass: string;
  confidentCount: number;
  uncertainCount: number;
  potentiallyNovelCount: number;
  manualReviewCount: number;
  uncertaintyThresholds: { lowConfidence: number; margin: number };
  gradCamCoverage: number;
  thresholdAnalysis: ThresholdPoint[];
  confusionInsights: ConfusionInsight[];
  aggregate: Record<string, HeatmapGroup | null>;
  gradCamMethod: string;
  evaluatedOn: string;
}
