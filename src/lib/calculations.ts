import type { CostConfig, MachineIncident, MachineParamSnapshot, ParamKey, ProductDefect, ProductSeverity, ReviewStatus, Severity, StandardValue } from "@/types";

/** downtimeCost = downtimeMinutes * costPerMinute */
export function downtimeCost(downtimeMinutes: number, costPerMinute: number): number {
  return downtimeMinutes * costPerMinute;
}

/** reworkCost = reworkedQuantity * reworkCostPerUnit */
export function reworkCost(reworkedQuantity: number, reworkCostPerUnit: number): number {
  return reworkedQuantity * reworkCostPerUnit;
}

/** scrapCost = scrappedQuantity * manufacturingCostPerUnit */
export function scrapCost(scrappedQuantity: number, manufacturingCostPerUnit: number): number {
  return scrappedQuantity * manufacturingCostPerUnit;
}

/** productLoss = reworkCost + scrapCost */
export function productLoss(rework: number, scrap: number): number {
  return rework + scrap;
}

/**
 * A defect only counts toward confirmed loss once it's either auto-accepted
 * (high confidence) or a human has approved it. "pending_review" (low
 * confidence / novel pattern -- the model couldn't tell) and "rejected"
 * (human determined it isn't actually a defect) are excluded: uncertain
 * calls shouldn't inflate real financial totals until someone confirms them.
 */
export function isConfirmedDefect(reviewStatus: ReviewStatus): boolean {
  return reviewStatus === "auto" || reviewStatus === "approved";
}

export function defectProductLoss(
  defect: ProductDefect,
  reworkCostPerUnit: number,
  manufacturingCostPerUnit: number
): { rework: number; scrap: number; total: number } {
  const rework = reworkCost(defect.reworkedQuantity, reworkCostPerUnit);
  const scrap = scrapCost(defect.scrappedQuantity, manufacturingCostPerUnit);
  return { rework, scrap, total: productLoss(rework, scrap) };
}

/**
 * Classifies a live reading against its reference window.
 * Inside [min, max] -> normal. Outside, severity scales with how far past
 * the boundary the reading is, relative to the width of the normal band.
 */
export function getParameterSeverity(actual: number, min: number, max: number): Severity {
  if (actual >= min && actual <= max) return "normal";
  const range = max - min || 1;
  const diff = actual < min ? min - actual : actual - max;
  const ratio = diff / range;
  return ratio > 0.5 ? "critical" : "warning";
}

export function deviation(actual: number, min: number, max: number): { amount: number; direction: "above" | "below" | "none" } {
  if (actual > max) return { amount: +(actual - max).toFixed(2), direction: "above" };
  if (actual < min) return { amount: +(min - actual).toFixed(2), direction: "below" };
  return { amount: 0, direction: "none" };
}

const SEVERITY_RANK: Record<Severity, number> = { normal: 0, warning: 1, critical: 2 };
export function severityRank(s: Severity): number {
  return SEVERITY_RANK[s];
}

/**
 * Business-impact severity for a defective product. Configurable thresholds
 * on top of: money lost, size of the deviation from target, and whether any
 * of that loss is unrecoverable scrap (weighted heavier than reworkable loss
 * since the material and labor are gone for good). Not a model prediction.
 */
export function productSeverity(totalLoss: number, deviationRatio: number, scrapAmount: number): ProductSeverity {
  if (scrapAmount > 0 && totalLoss >= 1500) return "critical";
  if (totalLoss >= 500 || deviationRatio >= 0.12) return "high";
  if (totalLoss >= 150 || deviationRatio >= 0.05) return "medium";
  return "low";
}

export function deviationRatio(target: number, actual: number): number {
  if (target === 0) return 0;
  return Math.abs(actual - target) / target;
}

export function formatCurrency(amount: number): string {
  return `₹${Math.round(amount).toLocaleString("en-IN")}`;
}

export function formatMinutesAsHours(minutes: number): string {
  const hrs = minutes / 60;
  if (hrs < 1) return `${Math.round(minutes)} min`;
  return `${hrs % 1 === 0 ? hrs : hrs.toFixed(1)} hrs`;
}

const PARAM_LABELS: Record<ParamKey, string> = {
  temperature: "Temperature",
  pressure: "Rolling Pressure",
  speed: "Speed",
  vibration: "Vibration",
};

/**
 * Heuristic, deterministic "explainability": how much each of the four
 * machine parameters contributed to this product's defect classification,
 * as the share of total out-of-range deviation it accounts for. This is
 * not a trained attribution model (no SHAP/gradients involved) -- it is a
 * transparent stand-in with the same shape, so a real explainability
 * output can be swapped in later without changing the UI.
 */
export function parameterContribution(
  actuals: MachineParamSnapshot,
  standardRows: StandardValue[]
): Array<{ key: ParamKey; label: string; actual: number; unit: string; severity: Severity; contribution: number }> {
  const keys: ParamKey[] = ["temperature", "pressure", "speed", "vibration"];
  const rows = keys.map((key) => {
    const std = standardRows.find((s) => s.parameter === key)!;
    const actual = actuals[key];
    const severity = getParameterSeverity(actual, std.min, std.max);
    const dev = deviation(actual, std.min, std.max);
    const range = std.max - std.min || 1;
    return { key, label: PARAM_LABELS[key], actual, unit: std.unit, severity, weight: dev.amount / range };
  });

  const totalWeight = rows.reduce((sum, r) => sum + r.weight, 0);
  return rows.map((r) => ({
    key: r.key,
    label: r.label,
    actual: r.actual,
    unit: r.unit,
    severity: r.severity,
    contribution: totalWeight > 0 ? r.weight / totalWeight : 0,
  }));
}

/**
 * Root-cause correlation quality: of the traced defects, what share had at
 * least one machine parameter outside its normal window at the moment of
 * production. Computed directly from the defect + standard-value records,
 * not a separate mock number.
 */
export function rootCauseHitRate(
  defects: ProductDefect[],
  standardValues: StandardValue[]
): { hits: number; total: number; hitRate: number; byParameter: Array<{ label: string; count: number }> } {
  const keys: ParamKey[] = ["temperature", "pressure", "speed", "vibration"];
  const counts: Record<string, number> = {};
  let hits = 0;

  for (const defect of defects) {
    const rows = standardValues.filter((s) => s.machineId === defect.machineId && keys.includes(s.parameter as ParamKey));
    let hasAbnormal = false;
    for (const key of keys) {
      const std = rows.find((s) => s.parameter === key);
      if (!std) continue;
      const actual = defect.machineParametersAtProduction[key];
      if (getParameterSeverity(actual, std.min, std.max) !== "normal") {
        hasAbnormal = true;
        counts[PARAM_LABELS[key]] = (counts[PARAM_LABELS[key]] ?? 0) + 1;
      }
    }
    if (hasAbnormal) hits += 1;
  }

  const byParameter = Object.entries(counts)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);

  return { hits, total: defects.length, hitRate: defects.length > 0 ? hits / defects.length : 0, byParameter };
}

export interface ProcessEvidenceRow {
  key: ParamKey;
  label: string;
  actual: number;
  unit: string;
  min: number;
  max: number;
  severity: Severity;
  contribution: number;
  linkedIncident: {
    id: string;
    severity: MachineIncident["severity"];
    status: string;
    downtimeMinutes: number;
    downtimeCost: number;
  } | null;
}

export interface EvidenceCase {
  observedIssue: string;
  inspectionEvidence: string;
  processEvidence: ProcessEvidenceRow[];
  economicEvidence: {
    ownLoss: number;
    patternMachineId: string | null;
    patternParameterLabel: string | null;
    patternAffectedCount: number;
    patternTotalLoss: number;
    linkedIncidentDowntimeCost: number;
  };
  modelFinding: string;
  recommendation: string;
  confidencePct: number;
}

/**
 * Fuses inspection, process (standard-value + incident), and economic
 * evidence for one defective product into a single traceable case -- every
 * figure here is computed live from the existing linked records (joined on
 * machineId/parameter), nothing is hardcoded or looked up from a fixed
 * table. Wording is deliberately correlational ("associated with"), never
 * causal, since none of this data supports a causal claim.
 */
export function buildEvidenceCase(
  defect: ProductDefect,
  allDefects: ProductDefect[],
  standardValues: StandardValue[],
  incidents: MachineIncident[],
  costConfig: CostConfig
): EvidenceCase {
  const machineStdRows = standardValues.filter((s) => s.machineId === defect.machineId);
  const contributionRows = parameterContribution(defect.machineParametersAtProduction, machineStdRows);

  const processEvidence: ProcessEvidenceRow[] = contributionRows.map((row) => {
    const std = machineStdRows.find((s) => s.parameter === row.key)!;
    const linked = incidents.find(
      (i) => i.machineId === defect.machineId && i.parameter === row.key && i.date === "Today"
    );
    return {
      key: row.key,
      label: row.label,
      actual: row.actual,
      unit: row.unit,
      min: std.min,
      max: std.max,
      severity: row.severity,
      contribution: row.contribution,
      linkedIncident: linked
        ? {
            id: linked.id,
            severity: linked.severity,
            status: linked.status,
            downtimeMinutes: linked.downtimeMinutes,
            downtimeCost: downtimeCost(linked.downtimeMinutes, linked.costPerMinute),
          }
        : null,
    };
  });

  const abnormal = processEvidence.filter((p) => p.severity !== "normal").sort((a, b) => b.contribution - a.contribution);
  const topParam = abnormal[0] ?? null;

  const ownLossFig = defectProductLoss(defect, costConfig.reworkCostPerUnit, costConfig.manufacturingCostPerUnit);

  let patternMachineId: string | null = null;
  let patternParameterLabel: string | null = null;
  let patternAffectedCount = 0;
  let patternTotalLoss = 0;

  if (topParam) {
    patternMachineId = defect.machineId;
    patternParameterLabel = topParam.label;
    const patternDefects = allDefects.filter((d) => {
      if (d.productId === defect.productId) return false;
      if (d.machineId !== defect.machineId) return false;
      if (!isConfirmedDefect(d.reviewStatus)) return false;
      const std = standardValues.find((s) => s.machineId === d.machineId && s.parameter === topParam.key);
      if (!std) return false;
      return getParameterSeverity(d.machineParametersAtProduction[topParam.key], std.min, std.max) !== "normal";
    });
    patternAffectedCount = patternDefects.length;
    patternTotalLoss = patternDefects.reduce((sum, d) => {
      const { total } = defectProductLoss(d, costConfig.reworkCostPerUnit, costConfig.manufacturingCostPerUnit);
      return sum + total;
    }, 0);
  }

  const linkedIncidentDowntimeCost = topParam?.linkedIncident?.downtimeCost ?? 0;

  const modelFinding = topParam
    ? `The process parameter pattern (${topParam.label} at ${topParam.actual}${topParam.unit}, outside the ${topParam.min}–${topParam.max}${topParam.unit} normal range) is associated with elevated defect risk on ${defect.machineId} — an association across the traced records, not a proven cause.`
    : `No abnormal machine parameter was recorded for this product at production time — insufficient process evidence to associate a parameter pattern with this defect.`;

  const recommendationParts: string[] = [];
  if (topParam) {
    recommendationParts.push(`Investigate ${topParam.label.toLowerCase()} control on ${defect.machineId}.`);
    if (patternAffectedCount > 0) {
      recommendationParts.push(
        `${patternAffectedCount} other confirmed defect${patternAffectedCount > 1 ? "s" : ""} on this machine share the same abnormal ${topParam.label.toLowerCase()} pattern, totaling ${formatCurrency(patternTotalLoss)} in confirmed loss.`
      );
    }
    if (topParam.linkedIncident) {
      recommendationParts.push(
        `A logged ${topParam.linkedIncident.severity} incident (${topParam.linkedIncident.id}) on this machine/parameter carries ${formatCurrency(linkedIncidentDowntimeCost)} in downtime cost.`
      );
    }
  } else {
    recommendationParts.push("No abnormal process parameter found — consider material, tooling, or unmeasured factors.");
  }

  return {
    observedIssue: `${defect.defectType} defect on ${defect.productId} (${defect.machineId}), actual ${defect.actualValue}${defect.unit} vs target ${defect.targetValue}${defect.unit}.`,
    inspectionEvidence: `Vision classification confidence ${(defect.confidence * 100).toFixed(0)}%, review status: ${defect.reviewStatus.replace("_", " ")}.`,
    processEvidence,
    economicEvidence: {
      ownLoss: ownLossFig.total,
      patternMachineId,
      patternParameterLabel,
      patternAffectedCount,
      patternTotalLoss,
      linkedIncidentDowntimeCost,
    },
    modelFinding,
    recommendation: recommendationParts.join(" "),
    confidencePct: defect.confidence * 100,
  };
}

/** Overall accuracy = trace(confusion matrix) / sum(confusion matrix). */
export function accuracyFromConfusion(matrix: number[][]): number {
  let correct = 0;
  let total = 0;
  matrix.forEach((row, i) => {
    row.forEach((count, j) => {
      total += count;
      if (i === j) correct += count;
    });
  });
  return total > 0 ? correct / total : 0;
}
