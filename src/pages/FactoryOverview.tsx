import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ScanEye,
  AlertOctagon,
  Percent,
  CheckCircle2,
  Gauge,
  ShieldQuestion,
  Eye,
  ArrowUpRight,
  Info,
  Factory,
  Lightbulb,
} from "lucide-react";
import { api } from "@/lib/api";
import { Card, CardBody, CardHeader, CardLabel, CardTitle } from "@/components/ui/Card";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { GoodVsDefectiveChart } from "@/components/charts/GoodVsDefectiveChart";
import { DefectDistributionChart } from "@/components/charts/DefectDistributionChart";
import { AttributionHeatmapGrid } from "@/components/charts/AttributionHeatmapGrid";
import type { AggregateHeatmap, DefectDistributionEntry } from "@/types";

/**
 * Real-data home page: every number here comes from GET /api/vision/heatmap,
 * which is precomputed by ml/aggregate_heatmaps.py running the actual
 * trained model over the actual 1,800-image held-out test split. Nothing
 * on this page is seeded/synthetic -- the older demo widgets (machines,
 * incidents, production/economic figures) moved off this page; they're
 * still reachable from the sidebar, clearly tagged "Demo data".
 */
export function FactoryOverview() {
  const [heatmap, setHeatmap] = useState<AggregateHeatmap | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .visionHeatmap()
      .then(setHeatmap)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load analysis"));
  }, []);

  if (error) {
    return (
      <Card className="flex items-start gap-3 border-status-critical/30 bg-status-critical-bg/40 p-4">
        <AlertOctagon className="mt-0.5 h-5 w-5 shrink-0 text-status-critical" />
        <div className="text-sm text-ink-muted">
          <span className="font-semibold text-ink">Couldn&rsquo;t load the analysis run.</span> {error}
        </div>
      </Card>
    );
  }

  if (!heatmap) {
    return <p className="text-sm text-ink-faint">Loading real analysis run…</p>;
  }

  const defectRate = heatmap.defectiveImages / heatmap.imagesAnalyzed;
  const acceptableRate = heatmap.acceptableImages / heatmap.imagesAnalyzed;
  const gradCamCoveragePct = heatmap.gradCamCoverage / heatmap.imagesAnalyzed;

  const distributionData: DefectDistributionEntry[] = Object.entries(heatmap.perClassCounts)
    .filter(([cls]) => cls !== heatmap.acceptableClass)
    .map(([category, units]) => ({ category, units }));

  const confidenceRows = Object.entries(heatmap.perClassMeanConfidence)
    .filter(([, v]) => v !== null)
    .sort((a, b) => (b[1] as number) - (a[1] as number));

  const allDefectsGroup = heatmap.aggregate.all_defects;

  return (
    <div className="space-y-6">
      <div>
        <div className="font-label text-[11px] uppercase tracking-wider text-ink-faint">
          AI Quality Analysis · Current Analysis Run
        </div>
        <h1 className="mt-1 text-3xl font-bold text-ink">Factory Overview</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Real results from the trained vision model run over the organizer inspection dataset&rsquo;s held-out test
          split — {heatmap.imagesAnalyzed.toLocaleString()} images, evaluated once, not a live feed.
        </p>
      </div>

      <Card className="flex items-start gap-3 bg-status-info-bg/50 p-4">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-status-info" />
        <div className="text-xs text-ink-muted">
          This is an <span className="font-semibold text-ink">advisory software system</span>, not a live factory
          connection — there is no PLC/SCADA link, no real-time machine data, and no physical control. Every figure
          below is computed from actual model inference; nothing is hardcoded.
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KpiCard icon={Eye} label="Total Inspections" value={heatmap.imagesAnalyzed.toLocaleString()} sublabel="Held-out test images" tone="info" />
        <KpiCard
          icon={AlertOctagon}
          label="Defective Inspections"
          value={heatmap.defectiveImages.toLocaleString()}
          sublabel={`${(defectRate * 100).toFixed(1)}% defect rate`}
          tone="critical"
        />
        <KpiCard
          icon={CheckCircle2}
          label="Acceptable Inspections"
          value={heatmap.acceptableImages.toLocaleString()}
          sublabel={`${(acceptableRate * 100).toFixed(1)}% acceptable rate`}
          tone="good"
        />
        <KpiCard
          icon={Percent}
          label="Average Model Confidence"
          value={`${(heatmap.overallMeanConfidence * 100).toFixed(1)}%`}
          sublabel="Across all inspections"
          tone="info"
        />
        <KpiCard
          icon={ShieldQuestion}
          label="Manual Review Cases"
          value={heatmap.manualReviewCount}
          sublabel={`${heatmap.uncertainCount} uncertain · ${heatmap.potentiallyNovelCount} potentially novel`}
          tone="warning"
        />
        <KpiCard icon={Gauge} label="Confident Predictions" value={heatmap.confidentCount.toLocaleString()} sublabel="Above both thresholds" tone="good" />
        <KpiCard
          icon={ScanEye}
          label="Visual Evidence Coverage"
          value={`${(gradCamCoveragePct * 100).toFixed(0)}%`}
          sublabel={`Grad-CAM generated for ${heatmap.gradCamCoverage.toLocaleString()} images`}
          tone="info"
        />
        <KpiCard icon={Factory} label="Dominant Defect Class" value={heatmap.dominantDefectClass ?? "—"} sublabel="By predicted count" tone="critical" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Defect Distribution</CardTitle>
            <CardLabel>Real predicted counts</CardLabel>
          </CardHeader>
          <CardBody>
            <DefectDistributionChart data={distributionData} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Acceptable vs Defective</CardTitle>
            <CardLabel>Test-split mix</CardLabel>
          </CardHeader>
          <CardBody>
            <GoodVsDefectiveChart
              good={heatmap.acceptableImages}
              defective={heatmap.defectiveImages}
              goodLabel="Acceptable"
              centerLabel="Acceptable rate"
            />
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Mean Confidence by Class</CardTitle>
          <CardLabel>Real, from softmax output</CardLabel>
        </CardHeader>
        <CardBody className="space-y-2.5 pt-3">
          {confidenceRows.map(([cls, conf]) => (
            <div key={cls} className="flex items-center gap-3">
              <div className="w-24 shrink-0 text-xs font-medium capitalize text-ink">{cls}</div>
              <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-bg">
                <div className="h-full rounded-full bg-status-info" style={{ width: `${(conf as number) * 100}%` }} />
              </div>
              <div className="w-14 shrink-0 text-right text-xs font-semibold tabular-nums text-ink">{((conf as number) * 100).toFixed(1)}%</div>
            </div>
          ))}
        </CardBody>
      </Card>

      {allDefectsGroup && (
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Visual Defect Localization — Model Attribution</CardTitle>
              <p className="mt-1 text-xs text-ink-muted">
                Aggregated from {allDefectsGroup.count.toLocaleString()} real defective inspections using Grad-CAM.
                Model-based visual attribution — not ground-truth segmentation.
              </p>
            </div>
          </CardHeader>
          <CardBody className="pt-3">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-[220px_1fr] sm:items-center">
              <AttributionHeatmapGrid grid={allDefectsGroup.grid} size={220} />
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-ink-muted">Highest-attribution region</span><span className="font-semibold capitalize text-ink">{allDefectsGroup.peakRegion.replace("-", " ")}</span></div>
                <div className="flex justify-between"><span className="text-ink-muted">Mean confidence in this group</span><span className="font-semibold text-ink">{(allDefectsGroup.meanConfidence * 100).toFixed(1)}%</span></div>
                <Link to="/inspection-intelligence" className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-status-info hover:underline">
                  Explore per-class heatmaps &amp; real image evidence <ArrowUpRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      <Card className="border-border bg-bg/50">
        <CardHeader>
          <CardTitle>Process, Bottleneck &amp; Economic Analysis</CardTitle>
          <span className="text-xs text-ink-faint">Insufficient data</span>
        </CardHeader>
        <CardBody className="space-y-3 pt-3">
          <p className="text-xs text-ink-muted">
            The organizer dataset provides inspection images only — no product/batch/machine ID, timestamps, cycle
            time, throughput, process parameters, or cost data, and no key to join inspection results to a
            production record. Per the project&rsquo;s data-honesty rule, the following are therefore{" "}
            <span className="font-semibold text-ink">not shown as real</span>:
          </p>
          <ul className="ml-4 list-disc space-y-1 text-xs text-ink-muted">
            <li>Throughput, cycle-time, and machine/station utilization</li>
            <li>Bottleneck identification</li>
            <li>Root-cause / contributing-factor analysis linking defects to process conditions</li>
            <li>Downtime, scrap/rework cost, and profitability impact</li>
          </ul>
          <p className="text-xs text-ink-muted">
            The Standard Values, Machine Incidents, Product Defects, and Model Performance pages still demonstrate
            what this analysis looks like once real production/economic data is available — using clearly-labeled
            synthetic data, not connected to the real vision results above.
          </p>
          <Link to="/product-defects" className="inline-flex items-center gap-1.5 text-sm font-semibold text-status-info hover:underline">
            View synthetic demo workflow <ArrowUpRight className="h-4 w-4" />
          </Link>
        </CardBody>
      </Card>

      <Card className="border-status-good/30 bg-status-good-bg/40">
        <CardBody className="flex items-start gap-3 p-4">
          <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-status-good" />
          <div className="text-xs text-ink-muted">
            <span className="font-semibold text-ink">Evidence-based summary: </span>
            {(defectRate * 100).toFixed(1)}% of {heatmap.imagesAnalyzed.toLocaleString()} inspected images were
            classified defective, dominated by {heatmap.dominantDefectClass ?? "no single class"}. {heatmap.manualReviewCount} case
            {heatmap.manualReviewCount === 1 ? "" : "s"} fell below the confidence/margin threshold and need human review before being
            counted as confirmed. No process or economic linkage exists in this dataset, so no cost, bottleneck, or root-cause
            claim is made — only the inspection result and its visual evidence are advisory-actionable right now.
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
