import React, { useEffect, useRef, useState } from "react";
import { ScanEye, Upload, Loader2, Info, AlertTriangle, CheckCircle2, HelpCircle, Sparkles, LayoutGrid } from "lucide-react";
import { api } from "@/lib/api";
import { Card, CardBody, CardHeader, CardLabel, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfusionMatrix } from "@/components/charts/ConfusionMatrix";
import { AttributionHeatmapGrid } from "@/components/charts/AttributionHeatmapGrid";
import type { AggregateHeatmap, ModelInfo, QualityStatus, VisionResult } from "@/types";

const STATUS_TONE: Record<QualityStatus, "good" | "critical" | "warning"> = {
  ACCEPTABLE: "good",
  DEFECTIVE: "critical",
  UNCERTAIN: "warning",
  POTENTIALLY_NOVEL: "warning",
};

const STATUS_ICON: Record<QualityStatus, React.ElementType> = {
  ACCEPTABLE: CheckCircle2,
  DEFECTIVE: AlertTriangle,
  UNCERTAIN: HelpCircle,
  POTENTIALLY_NOVEL: Sparkles,
};

export function InspectionIntelligence() {
  const [modelInfo, setModelInfo] = useState<ModelInfo | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [result, setResult] = useState<VisionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const loadModelInfo = () => api.visionModelInfo().then(setModelInfo).catch(() => setModelInfo(null));

  useEffect(() => {
    loadModelInfo();
    const t = setInterval(loadModelInfo, 5000);
    return () => clearInterval(t);
  }, []);

  const onPick = (f: File) => {
    setFile(f);
    setResult(null);
    setError(null);
    setPreviewUrl(URL.createObjectURL(f));
  };

  const analyze = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const r = await api.analyzeImage(file);
      setResult(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed");
    } finally {
      setLoading(false);
    }
  };

  const metrics = modelInfo?.metrics;

  const [heatmap, setHeatmap] = useState<AggregateHeatmap | null>(null);
  const [heatmapError, setHeatmapError] = useState<string | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<string>("all_defects");
  const [sampleResult, setSampleResult] = useState<{ path: string; result: VisionResult } | null>(null);
  const [sampleLoading, setSampleLoading] = useState<string | null>(null);

  useEffect(() => {
    api
      .visionHeatmap()
      .then(setHeatmap)
      .catch((e) => setHeatmapError(e instanceof Error ? e.message : "Failed to load heatmap"));
  }, []);

  const groupEntries = heatmap ? Object.entries(heatmap.aggregate).filter((entry): entry is [string, NonNullable<typeof entry[1]>] => entry[1] !== null) : [];
  const activeGroup = groupEntries.find(([key]) => key === selectedGroup)?.[1] ?? groupEntries[0]?.[1] ?? null;

  const inspectSample = async (relPath: string) => {
    setSampleLoading(relPath);
    try {
      const result = await api.analyzeSample(relPath);
      setSampleResult({ path: relPath, result });
    } catch {
      // leave previous sampleResult in place; the click can be retried
    } finally {
      setSampleLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="font-label text-[11px] uppercase tracking-wider text-ink-faint">
          Real Organizer Data · Trained Vision Model
        </div>
        <h1 className="mt-1 text-3xl font-bold text-ink">AI Inspection Intelligence</h1>
        <p className="mt-1 text-sm text-ink-muted">
          A real CNN, trained on the organizer-provided <code className="rounded bg-bg px-1 py-0.5">train/</code> image
          set (12,000 images · crack / hole / normal / rust / scratch), classifies an inspection image and shows the
          visual evidence behind its call.
        </p>
      </div>

      <Card className="flex items-start gap-3 bg-status-info-bg/50 p-4">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-status-info" />
        <div className="text-xs text-ink-muted">
          <span className="font-semibold text-ink">This page only covers the vision layer.</span> The organizer dataset
          contains inspection images only — no production, process, or economic data, and no linking IDs between them.
          The Factory Overview / Machine Incidents / Product Defects / Model Performance pages remain{" "}
          <span className="font-semibold text-ink">demo/synthetic data</span> for illustrating those workflows, and are
          <span className="font-semibold text-ink"> not connected</span> to this real model or to each other.
        </div>
      </Card>

      {modelInfo && !modelInfo.ready && (
        <Card className="flex items-center gap-3 border-status-warning/40 bg-status-warning-bg/50 p-4">
          <Loader2 className="h-5 w-5 shrink-0 animate-spin text-status-warning" />
          <div className="text-xs text-ink-muted">
            <span className="font-semibold text-ink">Model not loaded yet.</span> {modelInfo.loadError ?? "Training may still be running."}
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Inspection Image</CardTitle>
            <CardLabel>Upload → Analyze</CardLabel>
          </CardHeader>
          <CardBody className="space-y-4 pt-3">
            <button
              onClick={() => inputRef.current?.click()}
              className="flex h-48 w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-bg text-ink-muted hover:border-status-info hover:text-status-info"
            >
              {previewUrl ? (
                <img src={previewUrl} alt="Selected" className="h-full w-full rounded-lg object-contain p-2" />
              ) : (
                <>
                  <Upload className="h-6 w-6" />
                  <span className="text-sm font-medium">Click to select an inspection image</span>
                  <span className="text-xs text-ink-faint">PNG or JPG</span>
                </>
              )}
            </button>
            <input
              ref={inputRef}
              type="file"
              accept="image/png,image/jpeg"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && onPick(e.target.files[0])}
            />
            <Button variant="primary" className="w-full justify-center" onClick={analyze} disabled={!file || loading || !modelInfo?.ready}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanEye className="h-4 w-4" />}
              {loading ? "Analyzing…" : "Analyze"}
            </Button>
            {error && <p className="text-xs text-status-critical">{error}</p>}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Result</CardTitle>
            {result && <CardLabel>{(result.confidence * 100).toFixed(1)}% confidence</CardLabel>}
          </CardHeader>
          <CardBody className="space-y-4 pt-3">
            {!result ? (
              <p className="text-sm text-ink-faint">Select and analyze an image to see the model's real prediction.</p>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  {(() => {
                    const Icon = STATUS_ICON[result.qualityStatus];
                    return <Icon className="h-8 w-8 text-ink" />;
                  })()}
                  <div>
                    <Badge tone={STATUS_TONE[result.qualityStatus]} className="text-sm">
                      {result.qualityStatus.replace("_", " ")}
                    </Badge>
                    <div className="mt-1 text-sm text-ink-muted">
                      Defect class: <span className="font-semibold text-ink">{result.defectClass}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  {Object.entries(result.probabilities)
                    .sort((a, b) => b[1] - a[1])
                    .map(([cls, p]) => (
                      <div key={cls} className="flex items-center gap-3">
                        <div className="w-20 shrink-0 text-xs font-medium capitalize text-ink">{cls}</div>
                        <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-bg">
                          <div className="h-full rounded-full bg-status-info" style={{ width: `${p * 100}%` }} />
                        </div>
                        <div className="w-12 shrink-0 text-right text-xs font-semibold tabular-nums text-ink">
                          {(p * 100).toFixed(1)}%
                        </div>
                      </div>
                    ))}
                </div>

                <div className="rounded-lg border border-border bg-bg p-3 text-xs text-ink-muted">
                  <span className="font-semibold text-ink">Uncertainty check: </span>
                  {result.uncertaintyReason}
                </div>
              </>
            )}
          </CardBody>
        </Card>
      </div>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle>Visual Evidence</CardTitle>
            <CardLabel>Model attribution, not ground truth</CardLabel>
          </CardHeader>
          <CardBody className="space-y-3 pt-3">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <div className="font-label mb-1.5 text-[10px] uppercase tracking-wider text-ink-faint">Original (preprocessed)</div>
                <img src={result.originalDataUrl} alt="Original" className="w-full rounded-lg border border-border" />
              </div>
              <div>
                <div className="font-label mb-1.5 text-[10px] uppercase tracking-wider text-ink-faint">Model Attribution Overlay</div>
                <img src={result.heatmapDataUrl} alt="Attribution heatmap" className="w-full rounded-lg border border-border" />
              </div>
            </div>
            <p className="text-xs text-ink-faint">
              <span className="font-semibold text-ink">{result.camMethod}</span> The train/ dataset has no bounding
              boxes or segmentation masks, so this is <span className="font-semibold text-ink">approximate defect
              localization</span> derived from the model's own learned features — not a verified ground-truth region.
            </p>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Visual Defect Localization — Model Attribution</CardTitle>
            <p className="mt-1 text-xs text-ink-muted">
              Aggregated from {heatmap?.imagesAnalyzed ?? "…"} actual inspection images using Grad-CAM. Highlights regions that
              contributed most to the vision model's defect prediction. This is model attribution, not ground-truth defect
              segmentation.
            </p>
          </div>
          <LayoutGrid className="h-5 w-5 shrink-0 text-ink-faint" />
        </CardHeader>
        <CardBody className="space-y-4 pt-3">
          {heatmapError && <p className="text-sm text-status-critical">{heatmapError}</p>}
          {!heatmap && !heatmapError && <p className="text-sm text-ink-faint">Loading real aggregate attribution data…</p>}

          {heatmap && (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
                <Stat label="Images analyzed" value={heatmap.imagesAnalyzed.toLocaleString()} />
                <Stat label="Defective (predicted)" value={heatmap.defectiveImages.toLocaleString()} />
                <Stat label="Acceptable (predicted)" value={heatmap.acceptableImages.toLocaleString()} />
                <Stat label="Dominant defect" value={heatmap.dominantDefectClass ?? "—"} />
                <Stat label="Avg. confidence" value={`${(heatmap.overallMeanConfidence * 100).toFixed(1)}%`} />
                <Stat label="Evaluated on" value="Held-out test split" />
              </div>

              <div className="flex flex-wrap gap-2">
                {groupEntries.map(([key, group]) => (
                  <button
                    key={key}
                    onClick={() => setSelectedGroup(key)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold capitalize transition-colors ${
                      (activeGroup === group)
                        ? "border-ink bg-ink text-surface"
                        : "border-border bg-surface text-ink-muted hover:border-ink/40"
                    }`}
                  >
                    {group.label} <span className="opacity-70">({group.count})</span>
                  </button>
                ))}
              </div>

              {activeGroup && (
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_1fr]">
                  <div>
                    <AttributionHeatmapGrid grid={activeGroup.grid} />
                    <div className="mt-2 flex items-center justify-between text-[11px] text-ink-faint">
                      <span>Fewer / no activation</span>
                      <span>Strong activation</span>
                    </div>
                    <div className="mt-3 space-y-1.5 text-xs">
                      <div className="flex justify-between"><span className="text-ink-muted">Images in group</span><span className="font-semibold text-ink">{activeGroup.count}</span></div>
                      <div className="flex justify-between"><span className="text-ink-muted">Highest activation region</span><span className="font-semibold text-ink capitalize">{activeGroup.peakRegion.replace("-", " ")}</span></div>
                      <div className="flex justify-between"><span className="text-ink-muted">Mean confidence</span><span className="font-semibold text-ink">{(activeGroup.meanConfidence * 100).toFixed(1)}%</span></div>
                    </div>
                  </div>

                  <div>
                    <div className="font-label mb-2 text-[10px] uppercase tracking-wider text-ink-faint">
                      Representative real images — click to see that image's own Grad-CAM
                    </div>
                    <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
                      {activeGroup.representativeImages.map((img) => (
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

                    {sampleResult && (
                      <div className="mt-4 rounded-lg border border-border bg-bg p-3">
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
                      </div>
                    )}
                  </div>
                </div>
              )}

              <p className="text-[11px] text-ink-faint">
                {heatmap.gradCamMethod} Grid coordinates are described as image regions (e.g. &ldquo;middle-center&rdquo;), not
                machine, line, or strip positions — the inspection dataset has no such fields.
              </p>
            </>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Model Validation</CardTitle>
          <CardLabel>Real evaluation on a held-out test split</CardLabel>
        </CardHeader>
        <CardBody className="space-y-4 pt-3">
          {!modelInfo?.metricsAvailable || !metrics ? (
            <p className="text-sm text-ink-faint">Insufficient data — evaluation metrics not available yet (training may still be running).</p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <Stat label="Test accuracy" value={`${(metrics.overall_accuracy * 100).toFixed(1)}%`} />
                <Stat label="Test set size" value={metrics.test_set_size} />
                <Stat label="Train / Val / Test" value={`${metrics.train_val_test_sizes.train} / ${metrics.train_val_test_sizes.val} / ${metrics.train_val_test_sizes.test}`} />
                <Stat label="Model parameters" value={metrics.model_parameters.toLocaleString()} />
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[480px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-border text-left">
                      {["Class", "Precision", "Recall", "F1", "Support"].map((h) => (
                        <th key={h} className="font-label px-3 py-2 text-[10px] uppercase tracking-wider text-ink-faint">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {metrics.per_class.map((c) => (
                      <tr key={c.class} className="border-b border-border/70 last:border-0">
                        <td className="px-3 py-2 font-semibold capitalize text-ink">{c.class}</td>
                        <td className="px-3 py-2 tabular-nums text-ink-muted">{(c.precision * 100).toFixed(1)}%</td>
                        <td className="px-3 py-2 tabular-nums text-ink-muted">{(c.recall * 100).toFixed(1)}%</td>
                        <td className="px-3 py-2 tabular-nums text-ink-muted">{(c.f1 * 100).toFixed(1)}%</td>
                        <td className="px-3 py-2 tabular-nums text-ink-muted">{c.support}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div>
                <CardLabel>Confusion matrix (test split)</CardLabel>
                <div className="mt-2">
                  <ConfusionMatrix labels={metrics.confusion_matrix_labels} matrix={metrics.confusion_matrix} />
                </div>
              </div>
            </>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-bg/60 px-3.5 py-3">
      <div className="font-label text-[10px] uppercase tracking-wider text-ink-faint">{label}</div>
      <div className="mt-1 text-xl font-bold tabular-nums text-ink">{value}</div>
    </div>
  );
}
