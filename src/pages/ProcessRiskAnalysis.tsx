import React, { useEffect, useRef, useState } from "react";
import {
  Database,
  Gauge,
  Ruler,
  ArrowRightLeft,
  ClipboardList,
  Lightbulb,
  ScanEye,
  SlidersHorizontal,
  IndianRupee,
  AlertTriangle,
  Loader2,
  Info,
} from "lucide-react";
import { api } from "@/lib/api";
import { Card, CardBody, CardHeader, CardLabel, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import type { AggregateHeatmap, ModelInfo, QualityStatus, VisionResult } from "@/types";

const STATUS_TONE: Record<QualityStatus, "good" | "critical" | "warning"> = {
  ACCEPTABLE: "good",
  DEFECTIVE: "critical",
  UNCERTAIN: "warning",
  POTENTIALLY_NOVEL: "warning",
};

function Unavailable({ reason }: { reason: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-dashed border-border bg-bg px-3 py-2.5 text-xs text-ink-faint">
      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>{reason}</span>
    </div>
  );
}

function SectionNumber({ n, title, icon: Icon }: { n: number; title: string; icon: React.ElementType }) {
  return (
    <div className="flex items-center gap-2">
      <span className="font-label flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-bg text-[10px] font-bold text-ink-faint">
        {n}
      </span>
      <Icon className="h-4 w-4 text-ink-faint" />
      <CardTitle>{title}</CardTitle>
    </div>
  );
}

export function ProcessRiskAnalysis() {
  const [heatmap, setHeatmap] = useState<AggregateHeatmap | null>(null);
  const [modelInfo, setModelInfo] = useState<ModelInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [selectedClass, setSelectedClass] = useState<string>("crack");
  const [sampleResult, setSampleResult] = useState<{ path: string; result: VisionResult } | null>(null);
  const [sampleLoading, setSampleLoading] = useState<string | null>(null);
  const [thresholdIdx, setThresholdIdx] = useState(0);

  useEffect(() => {
    Promise.all([api.visionHeatmap(), api.visionModelInfo()])
      .then(([h, m]) => {
        setHeatmap(h);
        setModelInfo(m);
        const t50 = h.thresholdAnalysis.findIndex((t) => t.threshold === 0.5);
        setThresholdIdx(t50 >= 0 ? t50 : 0);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load analysis"));
  }, []);

  const inspectSample = async (relPath: string) => {
    setSampleLoading(relPath);
    try {
      const result = await api.analyzeSample(relPath);
      setSampleResult({ path: relPath, result });
    } catch {
      // leave prior result, allow retry
    } finally {
      setSampleLoading(null);
    }
  };

  if (error) {
    return (
      <Card className="flex items-start gap-3 border-status-critical/30 bg-status-critical-bg/40 p-4">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-status-critical" />
        <div className="text-sm text-ink-muted">
          <span className="font-semibold text-ink">Couldn&rsquo;t load the analysis.</span> {error}
        </div>
      </Card>
    );
  }

  if (!heatmap || !modelInfo) {
    return <p className="text-sm text-ink-faint">Loading real process &amp; risk analysis…</p>;
  }

  const metrics = modelInfo.metrics;
  const classGroup = heatmap.aggregate[selectedClass];
  const currentThreshold = heatmap.thresholdAnalysis[thresholdIdx];
  const worstClass = metrics?.per_class ? [...metrics.per_class].sort((a, b) => a.f1 - b.f1)[0] : null;

  return (
    <div className="space-y-6">
      <div>
        <div className="font-label text-[11px] uppercase tracking-wider text-ink-faint">
          Real Data · Process Standards &amp; Risk Analysis
        </div>
        <h1 className="mt-1 text-3xl font-bold text-ink">Process Standards &amp; Risk Analysis</h1>
        <p className="mt-1 text-sm text-ink-muted">
          What process conditions are associated with defective outcomes, and what evidence supports the finding —
          built strictly from data that actually exists in this project.
        </p>
      </div>

      {/* 1. Data Source */}
      <Card>
        <CardHeader>
          <SectionNumber n={1} title="Data Source" icon={Database} />
        </CardHeader>
        <CardBody className="space-y-2 pt-3 text-xs text-ink-muted">
          <p>
            <span className="font-semibold text-ink">Real:</span> the organizer inspection image dataset (
            {metrics
              ? (metrics.train_val_test_sizes.train + metrics.train_val_test_sizes.val + metrics.train_val_test_sizes.test).toLocaleString()
              : "—"}
            -image pool, 5 classes: crack, hole, normal, rust, scratch) and the vision model trained on it — evaluated
            here on its {heatmap.imagesAnalyzed.toLocaleString()}-image held-out test split.
          </p>
          <p>
            <span className="font-semibold text-ink">Not present in this project:</span> no process/production
            dataset (no temperature, pressure, speed, vibration, or other sensor measurements), no machine/batch/product
            ID, no timestamps, and no economic dataset. Every section below reflects that honestly rather than
            substituting placeholder numbers.
          </p>
        </CardBody>
      </Card>

      {/* 2-4. Process parameters / reference ranges / deviation analysis */}
      <Card>
        <CardHeader>
          <SectionNumber n={2} title="Process Parameters, Reference Ranges &amp; Deviation Analysis" icon={Gauge} />
        </CardHeader>
        <CardBody className="space-y-3 pt-3">
          <Unavailable reason="Process data unavailable — the dataset contains inspection images only; no temperature, pressure, speed, vibration, or other process parameter measurements exist in the available data." />
          <Unavailable reason="Reference specification unavailable — no validated operating-range source exists for any process parameter in this project." />
          <Unavailable reason="Deviation analysis unavailable — depends on the process parameter data above, which does not exist." />
        </CardBody>
      </Card>

      {/* 5. Defect association (real, by inspection class) */}
      <Card>
        <CardHeader>
          <SectionNumber n={3} title="Defect Association — by Inspection Class" icon={Ruler} />
        </CardHeader>
        <CardBody className="space-y-3 pt-3">
          <p className="text-xs text-ink-muted">
            No process parameter exists to associate with defect outcomes. What <span className="font-semibold text-ink">is</span> real:
            per-class performance of the vision model on its held-out test set — the actual dimension this dataset
            supports.
          </p>
          {!metrics ? (
            <Unavailable reason="Model evaluation metrics unavailable." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    {["Class", "Observations", "Precision", "Recall", "F1", "Mean Confidence"].map((h) => (
                      <th key={h} className="font-label px-3 py-2 text-[10px] uppercase tracking-wider text-ink-faint">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {metrics.per_class.map((c) => (
                    <tr key={c.class} className="border-b border-border/70 last:border-0">
                      <td className="px-3 py-2 font-semibold capitalize text-ink">{c.class}</td>
                      <td className="px-3 py-2 tabular-nums text-ink-muted">{c.support}</td>
                      <td className="px-3 py-2 tabular-nums text-ink-muted">{(c.precision * 100).toFixed(1)}%</td>
                      <td className="px-3 py-2 tabular-nums text-ink-muted">{(c.recall * 100).toFixed(1)}%</td>
                      <td className="px-3 py-2 tabular-nums text-ink-muted">{(c.f1 * 100).toFixed(1)}%</td>
                      <td className="px-3 py-2 tabular-nums text-ink-muted">
                        {heatmap.perClassMeanConfidence[c.class] != null ? `${((heatmap.perClassMeanConfidence[c.class] as number) * 100).toFixed(1)}%` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      {/* 6. Potential contributing factors (real, from confusion matrix) */}
      <Card>
        <CardHeader>
          <SectionNumber n={4} title="Potential Contributing Factors — Model Ambiguity" icon={ArrowRightLeft} />
        </CardHeader>
        <CardBody className="space-y-3 pt-3">
          <p className="text-xs text-ink-muted">
            Not a manufacturing root cause — no process data exists to support that kind of claim. This is real,
            computed evidence of which classes the model visually confuses with which, from the actual true/predicted
            labels of the {heatmap.imagesAnalyzed.toLocaleString()} test images. Ranked by count, not a fixed order.
          </p>
          {heatmap.confusionInsights.length === 0 ? (
            <Unavailable reason="No misclassifications occurred in the test split — no ambiguity evidence to report." />
          ) : (
            <div className="space-y-2">
              {heatmap.confusionInsights.map((c) => (
                <div key={c.trueClass} className="rounded-lg border border-border px-3 py-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold capitalize text-ink">{c.trueClass} → confused with {c.confusedWith}</span>
                    <Badge tone="warning">{c.count} of {c.totalTrueSamples}</Badge>
                  </div>
                  <div className="mt-1 text-ink-muted">
                    {(c.confusionRate * 100).toFixed(1)}% of real {c.trueClass} images were predicted as {c.confusedWith} — visual
                    ambiguity between these two classes, not a process condition.
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      {/* 7. Visual evidence (real, interactive) */}
      <Card>
        <CardHeader>
          <SectionNumber n={5} title="Visual Evidence" icon={ScanEye} />
        </CardHeader>
        <CardBody className="space-y-4 pt-3">
          <div className="flex flex-wrap gap-2">
            {Object.keys(heatmap.aggregate)
              .filter((k) => k !== "all_defects")
              .map((cls) => (
                <button
                  key={cls}
                  onClick={() => { setSelectedClass(cls); setSampleResult(null); }}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold capitalize transition-colors ${
                    selectedClass === cls ? "border-ink bg-ink text-surface" : "border-border bg-surface text-ink-muted hover:border-ink/40"
                  }`}
                >
                  {cls} ({heatmap.aggregate[cls]?.count ?? 0})
                </button>
              ))}
          </div>

          {!classGroup ? (
            <Unavailable reason={`No real test images were predicted as "${selectedClass}" — nothing to show.`} />
          ) : (
            <>
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
                {classGroup.representativeImages.map((img) => (
                  <button
                    key={img.path}
                    onClick={() => inspectSample(img.path)}
                    className={`relative overflow-hidden rounded-lg border-2 transition-colors ${
                      sampleResult?.path === img.path ? "border-status-info" : "border-transparent hover:border-border"
                    }`}
                    title={`${img.path} · predicted ${img.predictedClass} · ${(img.confidence * 100).toFixed(0)}%`}
                  >
                    <img src={api.sampleImageUrl(img.path)} alt={img.path} className="aspect-square w-full object-cover" />
                    {sampleLoading === img.path && (
                      <span className="absolute inset-0 flex items-center justify-center bg-black/40">
                        <Loader2 className="h-4 w-4 animate-spin text-white" />
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {sampleResult ? (
                <div className="rounded-lg border border-border bg-bg p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-semibold text-ink">{sampleResult.path}</span>
                    <Badge tone={STATUS_TONE[sampleResult.result.qualityStatus]}>
                      {sampleResult.result.qualityStatus.replace("_", " ")} · {(sampleResult.result.confidence * 100).toFixed(1)}%
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <img src={sampleResult.result.originalDataUrl} alt="Original" className="w-full rounded-lg border border-border" />
                    <img src={sampleResult.result.heatmapDataUrl} alt="Grad-CAM overlay" className="w-full rounded-lg border border-border" />
                  </div>
                  <p className="mt-2 text-[11px] text-ink-faint">
                    {modelInfo.modelCard?.cam_method ?? "Model attribution overlay — approximate, not ground-truth segmentation."}
                  </p>
                </div>
              ) : (
                <p className="text-xs text-ink-faint">Click a real image above to run live inference and see its actual Grad-CAM attribution.</p>
              )}
            </>
          )}
        </CardBody>
      </Card>

      {/* 8. What-if analysis (real, confidence-threshold sweep) */}
      <Card>
        <CardHeader>
          <SectionNumber n={6} title="What-If Analysis — Confidence Threshold" icon={SlidersHorizontal} />
        </CardHeader>
        <CardBody className="space-y-4 pt-3">
          <p className="text-xs text-ink-muted">
            No process-parameter model exists in this project, so a manufacturing what-if (e.g. "what if temperature
            were lower") is <span className="font-semibold text-ink">unavailable</span>. What the real data{" "}
            <span className="font-semibold text-ink">does</span> support: sweeping the confidence threshold required
            for auto-acceptance and measuring the actual effect on the {heatmap.imagesAnalyzed.toLocaleString()}
            real held-out predictions.
          </p>
          {currentThreshold && (
            <>
              <div>
                <label className="font-label mb-2 block text-[10px] uppercase tracking-wider text-ink-faint">
                  Scenario threshold: {(currentThreshold.threshold * 100).toFixed(0)}%
                </label>
                <input
                  type="range"
                  min={0}
                  max={heatmap.thresholdAnalysis.length - 1}
                  step={1}
                  value={thresholdIdx}
                  onChange={(e) => setThresholdIdx(Number(e.target.value))}
                  className="w-full accent-ink"
                />
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat label="Auto-accepted (coverage)" value={`${(currentThreshold.coveragePct * 100).toFixed(1)}%`} />
                <Stat label="Images above threshold" value={currentThreshold.imagesAboveThreshold.toLocaleString()} />
                <Stat label="Images needing review" value={currentThreshold.imagesBelowThreshold.toLocaleString()} />
                <Stat
                  label="Accuracy among accepted"
                  value={currentThreshold.accuracyAmongCovered != null ? `${(currentThreshold.accuracyAmongCovered * 100).toFixed(2)}%` : "—"}
                />
              </div>
              <p className="text-[11px] text-ink-faint">
                Real tradeoff: raising the threshold reduces auto-accepted volume but raises accuracy among what remains
                auto-accepted — computed directly from the {heatmap.imagesAnalyzed.toLocaleString()} real test predictions and
                their real ground-truth labels, not simulated.
              </p>
            </>
          )}
        </CardBody>
      </Card>

      {/* 9. Economic impact */}
      <Card>
        <CardHeader>
          <SectionNumber n={7} title="Economic Impact" icon={IndianRupee} />
        </CardHeader>
        <CardBody className="pt-3">
          <Unavailable reason="Economic impact unavailable — no scrap cost, rework cost, downtime cost, or throughput/margin dataset exists in this project. Connect a real economic dataset with a valid link to inspection or production records to unlock this section." />
        </CardBody>
      </Card>

      {/* 10. Advisory recommendation (real, evidence-based) */}
      <Card className="border-status-good/30 bg-status-good-bg/40">
        <CardHeader>
          <SectionNumber n={8} title="Advisory Recommendation" icon={Lightbulb} />
        </CardHeader>
        <CardBody className="space-y-2 pt-3 text-xs text-ink-muted">
          <p>
            <span className="font-semibold text-ink">Evidence: </span>
            {worstClass && (
              <>
                the weakest-performing class is <span className="font-semibold capitalize text-ink">{worstClass.class}</span> (F1{" "}
                {(worstClass.f1 * 100).toFixed(1)}%, precision {(worstClass.precision * 100).toFixed(1)}%, recall{" "}
                {(worstClass.recall * 100).toFixed(1)}%).{" "}
              </>
            )}
            {heatmap.confusionInsights[0] && (
              <>
                The strongest visual ambiguity is {heatmap.confusionInsights[0].trueClass} vs {heatmap.confusionInsights[0].confusedWith} (
                {heatmap.confusionInsights[0].count} real cases).{" "}
              </>
            )}
            {heatmap.manualReviewCount} of {heatmap.imagesAnalyzed.toLocaleString()} real inspections (
            {((heatmap.manualReviewCount / heatmap.imagesAnalyzed) * 100).toFixed(1)}%) fall below the confidence/margin
            threshold and require human review before being treated as confirmed.
          </p>
          <p>
            <span className="font-semibold text-ink">Recommendation: </span>
            prioritize manual review capacity toward {worstClass ? <span className="capitalize">{worstClass.class}</span> : "the weakest class"} and{" "}
            {heatmap.confusionInsights[0]?.confusedWith ?? "ambiguous"}-adjacent predictions, since those are where the real
            evaluation data shows the model is least reliable.
          </p>
          <p>
            <span className="font-semibold text-ink">Not available: </span>
            no process-condition or economic recommendation can be made — this project has no production/process
            dataset and no economic dataset, and no valid key exists to join inspection records to either. Connecting
            such a dataset (with a real product/batch ID shared between inspection and production records) would
            unlock sections 2–4 and 7 of this page without any other change.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-bg/60 px-3.5 py-3">
      <div className="font-label text-[10px] uppercase tracking-wider text-ink-faint">{label}</div>
      <div className="mt-1 text-lg font-bold tabular-nums text-ink">{value}</div>
    </div>
  );
}
