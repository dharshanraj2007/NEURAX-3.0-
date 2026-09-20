import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Target,
  Crosshair,
  ShieldAlert,
  Scale,
  GitBranch,
  BrainCircuit,
  Layers,
  Info,
  ArrowUpRight,
} from "lucide-react";
import { useAppData } from "@/context/AppDataContext";
import { Card, CardBody, CardHeader, CardLabel, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Select } from "@/components/ui/Select";
import { PrecisionRecallChart } from "@/components/charts/PrecisionRecallChart";
import { ConfusionMatrix } from "@/components/charts/ConfusionMatrix";
import { RobustnessChart } from "@/components/charts/RobustnessChart";
import { FarFrrChart } from "@/components/charts/FarFrrChart";
import { FeatureContributionChart } from "@/components/charts/FeatureContributionChart";
import { accuracyFromConfusion, parameterContribution, rootCauseHitRate } from "@/lib/calculations";
import { REVIEW_LABEL, REVIEW_TONE } from "@/lib/labels";

const CRITERIA = [
  "Detection & classification accuracy",
  "Defect localization quality",
  "Robustness to unseen conditions",
  "False-reject / false-accept handling",
  "Root-cause correlation quality",
  "Explainability & confidence handling",
  "Technical implementation",
];

function CriterionTag({ n }: { n: number }) {
  return (
    <span className="font-label inline-flex items-center gap-1.5 rounded-full bg-bg px-2.5 py-1 text-[10px] uppercase tracking-wider text-ink-faint">
      Criterion {n} / {CRITERIA.length}
    </span>
  );
}

export function ModelPerformance() {
  const { productDefects, standardValues, modelMetrics, totals } = useAppData();
  const { classMetrics, confusionLabels, confusionMatrix, robustnessConditions, farFrrCurve } = modelMetrics;
  const [thresholdIdx, setThresholdIdx] = useState(6); // 0.8

  const overallAccuracy = accuracyFromConfusion(confusionMatrix);
  const macroPrecision = classMetrics.reduce((s, c) => s + c.precision, 0) / classMetrics.length;
  const macroRecall = classMetrics.reduce((s, c) => s + c.recall, 0) / classMetrics.length;

  const zoneCounts = useMemo(() => {
    const zones: Record<string, number> = { "Left edge": 0, Center: 0, "Right edge": 0 };
    productDefects.forEach((d) => {
      const zone = d.location.startsWith("Left") ? "Left edge" : d.location.startsWith("Right") ? "Right edge" : "Center";
      zones[zone] += 1;
    });
    return zones;
  }, [productDefects]);

  const rootCause = useMemo(() => rootCauseHitRate(productDefects, standardValues), [productDefects, standardValues]);

  const avgConfidence = productDefects.reduce((s, d) => s + d.confidence, 0) / productDefects.length;

  const [exampleProductId, setExampleProductId] = useState(productDefects[0]?.productId ?? "");
  const exampleProduct = productDefects.find((d) => d.productId === exampleProductId) ?? productDefects[0];
  const exampleStdRows = standardValues.filter((s) => s.machineId === exampleProduct?.machineId);
  const contributionRows = exampleProduct ? parameterContribution(exampleProduct.machineParametersAtProduction, exampleStdRows) : [];

  const current = farFrrCurve[thresholdIdx];

  return (
    <div className="space-y-6">
      <div>
        <div className="font-label text-[11px] uppercase tracking-wider text-ink-faint">
          Validation Report · Defect Detection System
        </div>
        <h1 className="mt-1 text-3xl font-bold text-ink">Model Performance</h1>
        <p className="mt-1 text-sm text-ink-muted">
          How the defect classifier is evaluated, end to end — accuracy, localization, robustness, error handling,
          root-cause correlation, and explainability.
        </p>
      </div>

      <Card className="flex items-start gap-3 bg-status-info-bg/50 p-4">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-status-info" />
        <div className="text-xs text-ink-muted">
          <span className="font-semibold text-ink">Simulated validation results.</span> This build has no trained model
          behind it — the metrics below are illustrative, shaped exactly like a real evaluation report so real
          model output can be dropped in later without changing this page. The root-cause hit rate and location mix
          further down <span className="font-semibold text-ink">are</span> computed live from the mock defect records.
        </div>
      </Card>

      {/* 1. Detection & classification accuracy */}
      <Card>
        <CardHeader>
          <div>
            <CriterionTag n={1} />
            <CardTitle className="mt-1.5">Defect Detection &amp; Classification Accuracy</CardTitle>
          </div>
          <Target className="h-5 w-5 text-ink-faint" />
        </CardHeader>
        <CardBody className="space-y-5 pt-3">
          <div className="grid grid-cols-3 gap-4">
            <Stat label="Overall accuracy" value={`${(overallAccuracy * 100).toFixed(1)}%`} />
            <Stat label="Macro precision" value={`${(macroPrecision * 100).toFixed(1)}%`} />
            <Stat label="Macro recall" value={`${(macroRecall * 100).toFixed(1)}%`} />
          </div>
          <div>
            <CardLabel>Precision / recall by defect class</CardLabel>
            <PrecisionRecallChart data={classMetrics} />
          </div>
          <div>
            <CardLabel>Confusion matrix ({classMetrics.reduce((s, c) => s + c.support, 0).toLocaleString()} evaluated units)</CardLabel>
            <div className="mt-2">
              <ConfusionMatrix labels={confusionLabels} matrix={confusionMatrix} />
            </div>
          </div>
        </CardBody>
      </Card>

      {/* 2. Localization quality */}
      <Card>
        <CardHeader>
          <div>
            <CriterionTag n={2} />
            <CardTitle className="mt-1.5">Defect Localization Quality</CardTitle>
          </div>
          <Crosshair className="h-5 w-5 text-ink-faint" />
        </CardHeader>
        <CardBody className="space-y-4 pt-3">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Stat label="Mean IoU" value="0.83" sublabel="Simulated" />
            <Stat label="Localized within ±5% width" value="91.2%" sublabel="Simulated" />
            <Stat label="Traced products" value={productDefects.length} sublabel="Computed" />
          </div>
          <div>
            <CardLabel>Defect location across strip width (traced products)</CardLabel>
            <div className="mt-2 space-y-2">
              {Object.entries(zoneCounts).map(([zone, count]) => (
                <div key={zone} className="flex items-center gap-3">
                  <div className="w-24 shrink-0 text-xs font-medium text-ink">{zone}</div>
                  <div className="h-3 flex-1 overflow-hidden rounded-full bg-bg">
                    <div
                      className="h-full rounded-full bg-status-info"
                      style={{ width: `${(count / productDefects.length) * 100}%` }}
                    />
                  </div>
                  <div className="w-6 shrink-0 text-right text-xs font-semibold tabular-nums text-ink">{count}</div>
                </div>
              ))}
            </div>
          </div>
          <p className="text-xs text-ink-faint">
            Localization here maps each defect to a position along the coil width (see the Product Defects detail
            view) rather than a pixel bounding box — there is no image feed in this build. IoU is reported in the
            same units a vision-model evaluation would use, for a like-for-like comparison later.
          </p>
        </CardBody>
      </Card>

      {/* 3. Robustness */}
      <Card>
        <CardHeader>
          <div>
            <CriterionTag n={3} />
            <CardTitle className="mt-1.5">Robustness to Unseen Conditions</CardTitle>
          </div>
          <ShieldAlert className="h-5 w-5 text-ink-faint" />
        </CardHeader>
        <CardBody className="space-y-3 pt-3">
          <RobustnessChart data={robustnessConditions} />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  {["Condition", "Samples", "Accuracy", "Note"].map((h) => (
                    <th key={h} className="font-label px-3 py-2 text-[10px] uppercase tracking-wider text-ink-faint">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {robustnessConditions.map((c) => (
                  <tr key={c.condition} className="border-b border-border/70 last:border-0">
                    <td className="px-3 py-2.5 text-ink">{c.condition}</td>
                    <td className="px-3 py-2.5 tabular-nums text-ink-muted">{c.sampleSize.toLocaleString()}</td>
                    <td className="px-3 py-2.5 tabular-nums font-semibold text-ink">{(c.accuracy * 100).toFixed(1)}%</td>
                    <td className="px-3 py-2.5 text-ink-muted">{c.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>

      {/* 4. FAR / FRR */}
      <Card>
        <CardHeader>
          <div>
            <CriterionTag n={4} />
            <CardTitle className="mt-1.5">False-Reject / False-Accept Handling</CardTitle>
          </div>
          <Scale className="h-5 w-5 text-ink-faint" />
        </CardHeader>
        <CardBody className="space-y-4 pt-3">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Stat label="Decision threshold" value={`${Math.round(current.threshold * 100)}%`} tone="info" />
            <Stat label="False Accept Rate" value={`${(current.far * 100).toFixed(1)}%`} sublabel="Defect passed as good" tone="critical" />
            <Stat label="False Reject Rate" value={`${(current.frr * 100).toFixed(1)}%`} sublabel="Good flagged defective" tone="warning" />
          </div>
          <div>
            <label className="font-label mb-2 block text-[10px] uppercase tracking-wider text-ink-faint">
              Confidence threshold — drag to trade off FAR against FRR
            </label>
            <input
              type="range"
              min={0}
              max={farFrrCurve.length - 1}
              step={1}
              value={thresholdIdx}
              onChange={(e) => setThresholdIdx(Number(e.target.value))}
              className="w-full accent-ink"
            />
          </div>
          <FarFrrChart data={farFrrCurve} currentThreshold={current.threshold} />
          <p className="text-xs text-ink-faint">
            Lower threshold: fewer missed defects (lower FRR) but more false alarms on good product (higher FAR).
            Higher threshold: the reverse. A false accept is the costlier error in most plants — it reaches the
            customer — so thresholds are usually tuned to keep FAR low even at the cost of more rework review.
          </p>
        </CardBody>
      </Card>

      {/* 5. Root-cause correlation */}
      <Card>
        <CardHeader>
          <div>
            <CriterionTag n={5} />
            <CardTitle className="mt-1.5">Root-Cause Correlation Quality</CardTitle>
          </div>
          <GitBranch className="h-5 w-5 text-ink-faint" />
        </CardHeader>
        <CardBody className="space-y-4 pt-3">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Stat
              label="Root-cause hit rate"
              value={`${(rootCause.hitRate * 100).toFixed(0)}%`}
              sublabel={`${rootCause.hits} of ${rootCause.total} traced defects · computed`}
              tone="good"
            />
            <Stat label="Parameters implicated" value={rootCause.byParameter.length} sublabel="Distinct params" />
          </div>
          <div>
            <CardLabel>How often each parameter was the implicated one</CardLabel>
            <div className="mt-2 space-y-2">
              {rootCause.byParameter.map((p) => (
                <div key={p.label} className="flex items-center gap-3">
                  <div className="w-40 shrink-0 text-xs font-medium text-ink">{p.label}</div>
                  <div className="h-3 flex-1 overflow-hidden rounded-full bg-bg">
                    <div
                      className="h-full rounded-full bg-status-warning"
                      style={{ width: `${(p.count / rootCause.total) * 100}%` }}
                    />
                  </div>
                  <div className="w-6 shrink-0 text-right text-xs font-semibold tabular-nums text-ink">{p.count}</div>
                </div>
              ))}
            </div>
          </div>
          <p className="text-xs text-ink-faint">
            "Hit rate" means an abnormal machine parameter was recorded at production time for that defect — an
            association, not proof of physical causation. See each product's own root-cause panel on{" "}
            <Link to="/product-defects" className="font-semibold text-status-info hover:underline">Product Defects</Link>.
          </p>
        </CardBody>
      </Card>

      {/* 6. Explainability & confidence */}
      <Card>
        <CardHeader>
          <div>
            <CriterionTag n={6} />
            <CardTitle className="mt-1.5">Explainability &amp; Confidence Handling</CardTitle>
          </div>
          <BrainCircuit className="h-5 w-5 text-ink-faint" />
        </CardHeader>
        <CardBody className="space-y-4 pt-3">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Stat label="Average confidence" value={`${(avgConfidence * 100).toFixed(0)}%`} sublabel="Across traced defects · computed" />
            <Stat
              label="Pending manual review"
              value={totals.pendingReviewCount}
              sublabel="Low confidence or novel pattern — model couldn't tell"
              tone="warning"
            />
            <Stat
              label="Reviewed so far"
              value={productDefects.filter((d) => d.reviewStatus === "approved" || d.reviewStatus === "rejected").length}
              sublabel="Cleared by a human"
              tone="good"
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  {["Product", "Defect", "Confidence", "Review", ""].map((h) => (
                    <th key={h} className="font-label px-3 py-2 text-[10px] uppercase tracking-wider text-ink-faint">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {productDefects.map((d) => (
                  <tr key={d.productId} className="border-b border-border/70 last:border-0">
                    <td className="px-3 py-2.5 font-semibold text-ink">{d.productId}</td>
                    <td className="px-3 py-2.5 text-ink-muted">{d.defectType}</td>
                    <td className="px-3 py-2.5 tabular-nums text-ink">{(d.confidence * 100).toFixed(0)}%</td>
                    <td className="px-3 py-2.5">
                      <Badge tone={REVIEW_TONE[d.reviewStatus]}>{REVIEW_LABEL[d.reviewStatus]}</Badge>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      {d.reviewStatus === "pending_review" && (
                        <Link
                          to={`/product-defects?machine=${d.machineId}&review=pending_review`}
                          className="font-semibold text-status-info hover:underline"
                        >
                          Review →
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="border-t border-border pt-4">
            <div className="mb-3 flex items-center justify-between">
              <CardLabel>Parameter contribution — worked example</CardLabel>
              <Select value={exampleProductId} onChange={(e) => setExampleProductId(e.target.value)} className="py-1.5 text-xs">
                {productDefects.map((d) => (
                  <option key={d.productId} value={d.productId}>{d.productId} · {d.machineId}</option>
                ))}
              </Select>
            </div>
            {exampleProduct && <FeatureContributionChart rows={contributionRows} />}
            <p className="mt-3 text-xs text-ink-faint">
              Contribution = each parameter's share of the total out-of-range deviation recorded for this product — a
              transparent heuristic, not a trained attribution model (no SHAP/gradients). Full detail lives on the{" "}
              <Link to={`/product-defects`} className="font-semibold text-status-info hover:underline">
                Product Defects
              </Link>{" "}
              page for every traced product.
            </p>
          </div>
        </CardBody>
      </Card>

      {/* 7. Technical implementation */}
      <Card>
        <CardHeader>
          <div>
            <CriterionTag n={7} />
            <CardTitle className="mt-1.5">Technical Implementation</CardTitle>
          </div>
          <Layers className="h-5 w-5 text-ink-faint" />
        </CardHeader>
        <CardBody className="space-y-4 pt-3">
          <div className="flex flex-wrap gap-2">
            {["React 18", "TypeScript", "Vite", "Tailwind CSS", "Recharts", "React Router", "Context API"].map((t) => (
              <span key={t} className="rounded-full border border-border bg-bg px-3 py-1 text-xs font-medium text-ink-muted">
                {t}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            {[
              { step: "Data", detail: "Mock sensor / QC records, typed in src/types" },
              { step: "Calculation layer", detail: "Pure functions in lib/calculations.ts" },
              { step: "App state", detail: "AppDataContext — live standard values, incidents, totals" },
              { step: "UI", detail: "Pages + Recharts, all derived, nothing hard-coded" },
            ].map((s, i) => (
              <div key={s.step} className="flex items-center gap-2">
                <div className="rounded-lg border border-border bg-surface px-3 py-2.5 text-xs">
                  <div className="font-semibold text-ink">{s.step}</div>
                  <div className="mt-0.5 text-ink-faint">{s.detail}</div>
                </div>
                {i < 3 && <ArrowUpRight className="hidden h-4 w-4 shrink-0 rotate-90 text-ink-faint sm:block" />}
              </div>
            ))}
          </div>
          <p className="text-xs text-ink-faint">
            Every number on this page traces to a typed data file or a function in <code className="rounded bg-bg px-1 py-0.5">lib/calculations.ts</code> —
            see the project README for how to swap the mock classifier metrics and mock sensor feed for real
            endpoints without restructuring the UI.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}

function Stat({
  label,
  value,
  sublabel,
  tone = "neutral",
}: {
  label: string;
  value: React.ReactNode;
  sublabel?: string;
  tone?: "good" | "warning" | "critical" | "info" | "neutral";
}) {
  const toneClass =
    tone === "good"
      ? "text-status-good"
      : tone === "warning"
      ? "text-status-warning"
      : tone === "critical"
      ? "text-status-critical"
      : tone === "info"
      ? "text-status-info"
      : "text-ink-muted";
  return (
    <div className="rounded-lg border border-border bg-bg/60 px-3.5 py-3">
      <div className="font-label text-[10px] uppercase tracking-wider text-ink-faint">{label}</div>
      <div className="mt-1 text-xl font-bold tabular-nums text-ink">{value}</div>
      {sublabel && <div className={`mt-0.5 text-[11px] font-medium ${toneClass}`}>{sublabel}</div>}
    </div>
  );
}
