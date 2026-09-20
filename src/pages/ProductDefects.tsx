import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowUpRight,
  Search,
  Info,
  ShieldQuestion,
  ShieldCheck,
  ShieldX,
  CheckCircle2,
  XCircle,
  ClipboardList,
  Factory,
  IndianRupee,
  Lightbulb,
  Gauge,
  AlertTriangle,
  PlusCircle,
  X,
  PenLine,
} from "lucide-react";
import { useAppData } from "@/context/AppDataContext";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  buildEvidenceCase,
  defectProductLoss,
  deviationRatio,
  formatCurrency,
  getParameterSeverity,
  isConfirmedDefect,
  parameterContribution,
  productSeverity,
} from "@/lib/calculations";
import { FeatureContributionChart } from "@/components/charts/FeatureContributionChart";
import { REVIEW_LABEL, REVIEW_TONE } from "@/lib/labels";
import type { CostConfig, MachineIncident, ManualDefectInput, ParamKey, ProductDefect, ProductSeverity, ReviewStatus, StandardValue } from "@/types";

const PARAM_ORDER: Array<{ key: ParamKey; label: string }> = [
  { key: "temperature", label: "Temperature" },
  { key: "pressure", label: "Rolling Pressure" },
  { key: "speed", label: "Speed" },
  { key: "vibration", label: "Vibration" },
];

const SEVERITY_TONE: Record<ProductSeverity, "good" | "warning" | "critical"> = {
  low: "good",
  medium: "warning",
  high: "warning",
  critical: "critical",
};

export function ProductDefects() {
  const [searchParams, setSearchParams] = useSearchParams();
  const machineFilter = searchParams.get("machine") ?? "all";
  const initialReview = (searchParams.get("review") as ReviewStatus | null) ?? "all";

  const { productDefects, standardValues, incidents, costConfig, machines, machineName, totals, reviewProductDefect, addProductDefect, production, getStandardValue } =
    useAppData();
  const [severityFilter, setSeverityFilter] = useState<"all" | ProductSeverity>("all");
  const [reviewFilter, setReviewFilter] = useState<"all" | ReviewStatus>(initialReview);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [showManualForm, setShowManualForm] = useState(false);
  const detailRef = useRef<HTMLDivElement>(null);

  const selectAndReveal = (productId: string) => {
    setSelectedProductId(productId);
    requestAnimationFrame(() => detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  const enriched = useMemo(
    () =>
      productDefects.map((d) => {
        const { rework, scrap, total } = defectProductLoss(d, costConfig.reworkCostPerUnit, costConfig.manufacturingCostPerUnit);
        const ratio = deviationRatio(d.targetValue, d.actualValue);
        const severity = productSeverity(total, ratio, scrap);
        return { defect: d, rework, scrap, total, ratio, severity };
      }),
    [productDefects, costConfig]
  );

  const filtered = enriched.filter(
    (e) =>
      (machineFilter === "all" || e.defect.machineId === machineFilter) &&
      (severityFilter === "all" || e.severity === severityFilter) &&
      (reviewFilter === "all" || e.defect.reviewStatus === reviewFilter)
  );

  useEffect(() => {
    if (filtered.length === 0) {
      setSelectedProductId(null);
      return;
    }
    if (!filtered.some((e) => e.defect.productId === selectedProductId)) {
      setSelectedProductId(filtered[0].defect.productId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [machineFilter, severityFilter, productDefects]);

  const selected = enriched.find((e) => e.defect.productId === selectedProductId) ?? null;

  return (
    <div className="space-y-6">
      <div>
        <div className="font-label text-[11px] uppercase tracking-wider text-ink-faint">
          Defect → Machine → Root Cause → Product Loss
        </div>
        <h1 className="mt-1 text-3xl font-bold text-ink">Product Defects</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Trace defective products back to the machine and conditions that produced them.
        </p>
      </div>

      <Card className="flex items-start gap-3 bg-status-info-bg/50 p-4">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-status-info" />
        <div className="text-xs text-ink-muted">
          Showing {productDefects.length} individually traced products out of the shift&rsquo;s full defect volume — only a sample gets
          full parameter traceability, matching real plant QC sampling.
        </div>
      </Card>

      {totals.pendingReviewCount > 0 && (
        <Card className="flex flex-wrap items-center justify-between gap-3 border-status-warning/40 bg-status-warning-bg/50 p-4">
          <div className="flex items-start gap-3">
            <ShieldQuestion className="mt-0.5 h-5 w-5 shrink-0 text-status-warning" />
            <div className="text-xs text-ink-muted">
              <span className="font-semibold text-ink">
                {totals.pendingReviewCount} product{totals.pendingReviewCount > 1 ? "s" : ""} awaiting manual review.
              </span>{" "}
              Low confidence or a pattern the model hasn&rsquo;t seen before — it couldn&rsquo;t tell either way, so a human has to.
              These carry {formatCurrency(totals.pendingReviewPotentialLoss)} in potential loss, excluded from every total on this
              app until someone decides.
            </div>
          </div>
          <Button variant="secondary" onClick={() => setReviewFilter("pending_review")}>
            Review now
          </Button>
        </Card>
      )}

      <Card>
        <CardBody className="flex flex-wrap gap-2.5">
          <Select value={machineFilter} onChange={(e) => setSearchParams(e.target.value === "all" ? {} : { machine: e.target.value })}>
            <option value="all">All Machines</option>
            {machines.map((m) => (
              <option key={m.id} value={m.id}>{m.id} · {m.name}</option>
            ))}
          </Select>
          <Select value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value as any)}>
            <option value="all">All Severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </Select>
          <Select value={reviewFilter} onChange={(e) => setReviewFilter(e.target.value as any)}>
            <option value="all">All Review States</option>
            <option value="pending_review">Pending Review</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="auto">Auto-accepted</option>
          </Select>
          <Button variant={showManualForm ? "secondary" : "primary"} className="ml-auto" onClick={() => setShowManualForm((v) => !v)}>
            {showManualForm ? <X className="h-4 w-4" /> : <PlusCircle className="h-4 w-4" />}
            {showManualForm ? "Cancel" : "Add Manual Entry"}
          </Button>
        </CardBody>
      </Card>

      {showManualForm && (
        <ManualEntryForm
          machines={machines}
          defectTypeOptions={production.defectDistribution.map((d) => d.category)}
          getStandardValue={getStandardValue}
          onCancel={() => setShowManualForm(false)}
          onSubmit={async (input) => {
            const created = await addProductDefect(input);
            setShowManualForm(false);
            selectAndReveal(created.productId);
          }}
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle>Defect Table</CardTitle>
          <span className="text-xs text-ink-faint">{filtered.length} products</span>
        </CardHeader>
        <CardBody className="pt-3">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  {["Product ID", "Machine", "Defect Type", "Target", "Actual", "Rework Cost", "Scrap Cost", "Total Loss", "Severity", "Review"].map((h) => (
                    <th key={h} className="font-label px-3 py-2 text-[10px] uppercase tracking-wider text-ink-faint">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(({ defect, rework, scrap, total, severity }) => {
                  const confirmed = isConfirmedDefect(defect.reviewStatus);
                  return (
                    <tr
                      key={defect.productId}
                      onClick={() => selectAndReveal(defect.productId)}
                      className={`cursor-pointer border-b border-border/70 last:border-0 transition-colors hover:bg-bg ${
                        selectedProductId === defect.productId ? "bg-bg" : ""
                      }`}
                    >
                      <td className="px-3 py-3 font-semibold text-ink">
                        <span className="flex items-center gap-1.5">
                          {defect.productId}
                          {defect.source === "manual" && (
                            <span title="Manually entered">
                              <PenLine className="h-3 w-3 text-status-info" />
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-ink-muted">{defect.machineId}</td>
                      <td className="px-3 py-3 text-ink-muted">{defect.defectType}</td>
                      <td className="px-3 py-3 tabular-nums text-ink-muted">{defect.targetValue.toFixed(2)} {defect.unit}</td>
                      <td className="px-3 py-3 tabular-nums text-ink">{defect.actualValue.toFixed(2)} {defect.unit}</td>
                      <td className="px-3 py-3 tabular-nums text-ink-muted">{formatCurrency(rework)}</td>
                      <td className="px-3 py-3 tabular-nums text-ink-muted">{formatCurrency(scrap)}</td>
                      <td className={`px-3 py-3 tabular-nums font-semibold ${confirmed ? "text-ink" : "text-ink-faint italic"}`}>
                        {formatCurrency(total)}
                        {!confirmed && <span className="ml-1 text-[10px] not-italic">(unconfirmed)</span>}
                      </td>
                      <td className="px-3 py-3">
                        <Badge tone={SEVERITY_TONE[severity]}>{severity.toUpperCase()}</Badge>
                      </td>
                      <td className="px-3 py-3">
                        <Badge tone={REVIEW_TONE[defect.reviewStatus]}>{REVIEW_LABEL[defect.reviewStatus]}</Badge>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-3 py-10 text-center text-sm text-ink-faint">
                      <Search className="mx-auto mb-2 h-5 w-5 text-ink-faint" />
                      No defective products match these filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>

      {selected && (
        <div ref={detailRef}>
          <ProductDetail
            entry={selected}
            standardValues={standardValues}
            incidents={incidents}
            allDefects={productDefects}
            costConfig={costConfig}
            machineName={machineName}
            onReview={reviewProductDefect}
          />
        </div>
      )}
    </div>
  );
}

function ProductDetail({
  entry,
  standardValues,
  incidents,
  allDefects,
  costConfig,
  machineName,
  onReview,
}: {
  entry: { defect: ProductDefect; rework: number; scrap: number; total: number; severity: ProductSeverity };
  standardValues: StandardValue[];
  incidents: MachineIncident[];
  allDefects: ProductDefect[];
  costConfig: CostConfig;
  machineName: (id: string) => string;
  onReview: (productId: string, decision: "approved" | "rejected") => Promise<void>;
}) {
  const { defect, rework, scrap, total, severity } = entry;
  const [reviewing, setReviewing] = useState(false);

  const decide = async (decision: "approved" | "rejected") => {
    setReviewing(true);
    try {
      await onReview(defect.productId, decision);
    } finally {
      setReviewing(false);
    }
  };

  const paramRows = PARAM_ORDER.map(({ key, label }) => {
    const std = standardValues.find((s) => s.machineId === defect.machineId && s.parameter === key)!;
    const actual = defect.machineParametersAtProduction[key];
    const paramSeverity = getParameterSeverity(actual, std.min, std.max);
    return { key, label, std, actual, paramSeverity };
  });

  const abnormal = paramRows.filter((p) => p.paramSeverity !== "normal");
  const contributionRows = parameterContribution(
    defect.machineParametersAtProduction,
    standardValues.filter((s) => s.machineId === defect.machineId)
  );
  const evidence = buildEvidenceCase(defect, allDefects, standardValues, incidents, costConfig);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>
            Selected Product · <span className="text-ink">{defect.productId}</span>
          </CardTitle>
          <div className="flex items-center gap-2">
            {defect.source === "manual" && (
              <Badge tone="info">
                <PenLine className="h-3 w-3" /> Manual Entry
              </Badge>
            )}
            <Badge tone={SEVERITY_TONE[severity]}>{severity.toUpperCase()}</Badge>
          </div>
        </CardHeader>
        <CardBody className="space-y-5 pt-3">
          <div className="text-xs text-ink-faint">Recorded {defect.recordedAt}</div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <Field label="Machine" value={`${defect.machineId} · ${machineName(defect.machineId)}`} />
            <Field label="Defect Type" value={defect.defectType} />
            <Field label="Target Value" value={`${defect.targetValue.toFixed(2)} ${defect.unit}`} />
            <Field label="Actual Value" value={`${defect.actualValue.toFixed(2)} ${defect.unit}`} />
            <Field label="Defect Location" value={defect.location} />
            <Field
              label="Classifier Confidence"
              value={
                <span className="flex items-center gap-2">
                  {(defect.confidence * 100).toFixed(0)}%
                  <Badge tone={REVIEW_TONE[defect.reviewStatus]}>{REVIEW_LABEL[defect.reviewStatus]}</Badge>
                </span>
              }
            />
          </div>

          <div className="border-t border-border pt-4">
            <div className="font-label mb-2 text-[10px] uppercase tracking-wider text-ink-faint">
              Product Loss · Rework + Scrap
            </div>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between text-ink-muted">
                <span>Rework cost ({defect.reworkedQuantity} units)</span>
                <span className="tabular-nums text-ink">{formatCurrency(rework)}</span>
              </div>
              <div className="flex justify-between text-ink-muted">
                <span>Scrap cost ({defect.scrappedQuantity} units)</span>
                <span className="tabular-nums text-ink">{formatCurrency(scrap)}</span>
              </div>
              <div className="mt-1.5 flex justify-between border-t border-border pt-1.5 text-sm font-bold text-ink">
                <span>Total Product Loss</span>
                <span className={`tabular-nums ${isConfirmedDefect(defect.reviewStatus) ? "text-status-critical" : "text-ink-faint"}`}>
                  {formatCurrency(total)}
                </span>
              </div>
              {!isConfirmedDefect(defect.reviewStatus) && (
                <div className="text-[11px] text-ink-faint">
                  {defect.reviewStatus === "pending_review"
                    ? "Not counted in factory totals until reviewed."
                    : "Excluded from factory totals — reviewed and confirmed not a defect."}
                </div>
              )}
            </div>
          </div>

          {defect.reviewStatus === "pending_review" && (
            <div className="rounded-lg border border-status-warning/40 bg-status-warning-bg/60 p-4">
              <div className="mb-1.5 flex items-center gap-1.5 text-sm font-bold text-status-warning">
                <ShieldQuestion className="h-4 w-4" /> Manual Review Required
              </div>
              <p className="text-xs text-ink-muted">
                Confidence is {(defect.confidence * 100).toFixed(0)}% — below the auto-accept threshold, or this pattern doesn&rsquo;t
                match anything the model was trained on. It can&rsquo;t tell you whether this is a real defect, so it&rsquo;s not
                counted as one anywhere in the app until a person decides.
              </p>
              <div className="mt-3 flex gap-2">
                <Button variant="primary" onClick={() => decide("approved")} disabled={reviewing}>
                  <CheckCircle2 className="h-4 w-4" />
                  Approve as Defect
                </Button>
                <Button variant="secondary" onClick={() => decide("rejected")} disabled={reviewing}>
                  <XCircle className="h-4 w-4" />
                  Reject (Not a Defect)
                </Button>
              </div>
            </div>
          )}

          {(defect.reviewStatus === "approved" || defect.reviewStatus === "rejected") && (
            <div
              className={`flex items-center gap-2 rounded-lg border p-3 text-xs ${
                defect.reviewStatus === "approved"
                  ? "border-status-good/40 bg-status-good-bg/60 text-status-good"
                  : "border-border bg-bg text-ink-muted"
              }`}
            >
              {defect.reviewStatus === "approved" ? <ShieldCheck className="h-4 w-4" /> : <ShieldX className="h-4 w-4" />}
              <span className="font-medium">
                Reviewed: {defect.reviewStatus === "approved" ? "confirmed as a defect" : "not a defect"}. This detection started at{" "}
                {(defect.confidence * 100).toFixed(0)}% model confidence.
              </span>
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Associated Machine Parameters</CardTitle>
          <span className="text-xs text-ink-faint">Recorded during production</span>
        </CardHeader>
        <CardBody className="space-y-4 pt-3">
          <div className="space-y-2.5">
            {paramRows.map((p) => (
              <div key={p.key} className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
                <div>
                  <div className="text-sm font-medium text-ink">{p.label}</div>
                  <div className="text-[11px] text-ink-faint">Normal {p.std.min}–{p.std.max}{p.std.unit}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="tabular-nums text-sm font-semibold text-ink">{p.actual}{p.std.unit}</span>
                  <Badge tone={p.paramSeverity === "normal" ? "good" : p.paramSeverity === "warning" ? "warning" : "critical"}>
                    {p.paramSeverity === "normal" ? "Normal" : p.paramSeverity === "warning" ? "Warning" : "Critical"}
                  </Badge>
                </div>
              </div>
            ))}
          </div>

          {abnormal.length > 0 && (
            <div className="rounded-lg border border-border bg-bg p-3">
              <div className="font-label mb-2 text-[10px] uppercase tracking-wider text-ink-faint">
                Parameter contribution (deviation-based)
              </div>
              <FeatureContributionChart rows={contributionRows} />
            </div>
          )}

          <Link to={`/machine-incidents?machine=${defect.machineId}`}>
            <Button variant="secondary" className="w-full justify-center">
              View machine condition <ArrowUpRight className="h-4 w-4" />
            </Button>
          </Link>
        </CardBody>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Evidence &amp; Recommendation</CardTitle>
          <span className="text-xs text-ink-faint">Inspection → Process → Economic evidence, fused live</span>
        </CardHeader>
        <CardBody className="space-y-4 pt-3">
          <EvidenceRow icon={Search} label="Observed Issue" text={evidence.observedIssue} />
          <EvidenceRow icon={ClipboardList} label="Inspection Evidence" text={evidence.inspectionEvidence} />

          <div>
            <EvidenceLabel icon={Factory} label="Process Evidence" />
            <div className="mt-2 space-y-2">
              {evidence.processEvidence
                .filter((p) => p.severity !== "normal")
                .map((p) => (
                  <div key={p.key} className="rounded-lg border border-border px-3 py-2.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-ink">{p.label}</span>
                      <Badge tone={p.severity === "critical" ? "critical" : "warning"}>{p.severity}</Badge>
                    </div>
                    <div className="mt-0.5 text-ink-muted">
                      actual {p.actual}{p.unit}, normal {p.min}–{p.max}{p.unit} · {(p.contribution * 100).toFixed(0)}% of deviation weight
                    </div>
                    {p.linkedIncident && (
                      <div className="mt-1.5 flex items-center gap-1.5 rounded bg-status-warning-bg/60 px-2 py-1 text-status-warning">
                        <AlertTriangle className="h-3 w-3 shrink-0" />
                        Linked incident {p.linkedIncident.id}: {p.linkedIncident.severity}, {p.linkedIncident.downtimeMinutes} min downtime,{" "}
                        {formatCurrency(p.linkedIncident.downtimeCost)} cost
                      </div>
                    )}
                  </div>
                ))}
              {evidence.processEvidence.every((p) => p.severity === "normal") && (
                <p className="text-xs text-ink-faint">No abnormal parameter recorded — insufficient process evidence.</p>
              )}
            </div>
          </div>

          <div>
            <EvidenceLabel icon={IndianRupee} label="Economic Evidence" />
            <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <EvidenceStat label="This product's loss" value={formatCurrency(evidence.economicEvidence.ownLoss)} />
              {evidence.economicEvidence.patternAffectedCount > 0 && (
                <>
                  <EvidenceStat label="Other defects, same pattern" value={evidence.economicEvidence.patternAffectedCount} />
                  <EvidenceStat label="Pattern's confirmed loss" value={formatCurrency(evidence.economicEvidence.patternTotalLoss)} />
                </>
              )}
              {evidence.economicEvidence.linkedIncidentDowntimeCost > 0 && (
                <EvidenceStat label="Linked incident downtime cost" value={formatCurrency(evidence.economicEvidence.linkedIncidentDowntimeCost)} />
              )}
              {evidence.economicEvidence.patternParameterLabel && evidence.economicEvidence.patternAffectedCount === 0 && (
                <div className="col-span-2 flex items-center rounded-lg border border-border bg-bg px-3 py-2 text-xs text-ink-faint sm:col-span-3">
                  No other confirmed defect on {defect.machineId} currently shares this {evidence.economicEvidence.patternParameterLabel.toLowerCase()} pattern.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-status-info/30 bg-status-info-bg/50 p-3">
            <EvidenceLabel icon={Gauge} label="Model Finding" />
            <p className="mt-1 text-xs text-ink-muted">{evidence.modelFinding}</p>
          </div>

          <div className="rounded-lg border border-status-good/30 bg-status-good-bg/50 p-3">
            <EvidenceLabel icon={Lightbulb} label="Advisory Recommendation" />
            <p className="mt-1 text-xs text-ink-muted">{evidence.recommendation}</p>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

function EvidenceLabel({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-ink">
      <Icon className="h-3.5 w-3.5" /> {label}
    </div>
  );
}

function EvidenceRow({ icon, label, text }: { icon: React.ElementType; label: string; text: string }) {
  return (
    <div>
      <EvidenceLabel icon={icon} label={label} />
      <p className="mt-1 text-xs text-ink-muted">{text}</p>
    </div>
  );
}

function EvidenceStat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-bg px-3 py-2">
      <div className="font-label text-[9px] uppercase tracking-wider text-ink-faint">{label}</div>
      <div className="mt-0.5 text-sm font-bold text-ink">{value}</div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="font-label text-[10px] uppercase tracking-wider text-ink-faint">{label}</div>
      <div className="mt-0.5 font-medium text-ink">{value}</div>
    </div>
  );
}

function ManualEntryForm({
  machines,
  defectTypeOptions,
  getStandardValue,
  onCancel,
  onSubmit,
}: {
  machines: Array<{ id: string; name: string }>;
  defectTypeOptions: string[];
  getStandardValue: (machineId: string, parameter: ParamKey | "thickness") => StandardValue | undefined;
  onCancel: () => void;
  onSubmit: (input: ManualDefectInput) => Promise<void>;
}) {
  const firstMachine = machines[0]?.id ?? "";
  const prefill = (machineId: string) => ({
    temperature: String(getStandardValue(machineId, "temperature")?.correctValue ?? ""),
    pressure: String(getStandardValue(machineId, "pressure")?.correctValue ?? ""),
    speed: String(getStandardValue(machineId, "speed")?.correctValue ?? ""),
    vibration: String(getStandardValue(machineId, "vibration")?.correctValue ?? ""),
  });

  const [machineId, setMachineId] = useState(firstMachine);
  const [defectType, setDefectType] = useState(defectTypeOptions[0] ?? "Thickness");
  const [targetValue, setTargetValue] = useState(() => String(getStandardValue(firstMachine, "thickness")?.correctValue ?? "2.00"));
  const [actualValue, setActualValue] = useState("");
  const [unit, setUnit] = useState("mm");
  const [reworkedQuantity, setReworkedQuantity] = useState("0");
  const [scrappedQuantity, setScrappedQuantity] = useState("0");
  const [location, setLocation] = useState("");
  const [params, setParams] = useState(() => prefill(firstMachine));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onMachineChange = (id: string) => {
    setMachineId(id);
    setParams(prefill(id));
    const thickness = getStandardValue(id, "thickness");
    if (thickness) {
      setTargetValue(String(thickness.correctValue));
      setUnit(thickness.unit);
    }
  };

  const numericFieldsValid =
    [targetValue, actualValue, reworkedQuantity, scrappedQuantity, params.temperature, params.pressure, params.speed, params.vibration].every(
      (v) => v !== "" && !Number.isNaN(Number(v))
    ) && !!machineId && !!defectType;

  const submit = async () => {
    if (!numericFieldsValid) {
      setError("Fill in every field with a valid number.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        machineId,
        defectType,
        targetValue: Number(targetValue),
        actualValue: Number(actualValue),
        unit,
        reworkedQuantity: Number(reworkedQuantity),
        scrappedQuantity: Number(scrappedQuantity),
        location: location.trim() || "Not specified",
        machineParametersAtProduction: {
          temperature: Number(params.temperature),
          pressure: Number(params.pressure),
          speed: Number(params.speed),
          vibration: Number(params.vibration),
        },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save this entry.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="border-status-info/40 bg-status-info-bg/30">
      <CardHeader>
        <CardTitle>Manual Defect Entry</CardTitle>
        <span className="text-xs text-ink-faint">Saved as a real record — feeds the same root-cause &amp; pattern analysis</span>
      </CardHeader>
      <CardBody className="space-y-4 pt-3">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <FormField label="Machine">
            <Select value={machineId} onChange={(e) => onMachineChange(e.target.value)} className="w-full">
              {machines.map((m) => (
                <option key={m.id} value={m.id}>{m.id} · {m.name}</option>
              ))}
            </Select>
          </FormField>
          <FormField label="Defect Type">
            <Select value={defectType} onChange={(e) => setDefectType(e.target.value)} className="w-full">
              {defectTypeOptions.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </Select>
          </FormField>
          <FormField label="Target Value">
            <NumberInput value={targetValue} onChange={setTargetValue} />
          </FormField>
          <FormField label="Actual Value">
            <NumberInput value={actualValue} onChange={setActualValue} placeholder="e.g. 2.35" />
          </FormField>
          <FormField label="Unit">
            <input
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm outline-none focus:border-ink/40"
            />
          </FormField>
          <FormField label="Reworked Qty">
            <NumberInput value={reworkedQuantity} onChange={setReworkedQuantity} />
          </FormField>
          <FormField label="Scrapped Qty">
            <NumberInput value={scrappedQuantity} onChange={setScrappedQuantity} />
          </FormField>
          <FormField label="Location (optional)">
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Center, 50% width"
              className="w-full rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm outline-none focus:border-ink/40"
            />
          </FormField>
        </div>

        <div>
          <div className="font-label mb-2 text-[10px] uppercase tracking-wider text-ink-faint">
            Machine parameters at production &mdash; pre-filled from {machineId || "the machine"}&rsquo;s standard values, edit to simulate an abnormal reading
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <FormField label="Temperature (°C)">
              <NumberInput value={params.temperature} onChange={(v) => setParams((p) => ({ ...p, temperature: v }))} />
            </FormField>
            <FormField label="Rolling Pressure (bar)">
              <NumberInput value={params.pressure} onChange={(v) => setParams((p) => ({ ...p, pressure: v }))} />
            </FormField>
            <FormField label="Speed (m/min)">
              <NumberInput value={params.speed} onChange={(v) => setParams((p) => ({ ...p, speed: v }))} />
            </FormField>
            <FormField label="Vibration (mm/s)">
              <NumberInput value={params.vibration} onChange={(v) => setParams((p) => ({ ...p, vibration: v }))} />
            </FormField>
          </div>
        </div>

        {error && <p className="text-xs text-status-critical">{error}</p>}

        <div className="flex gap-2">
          <Button variant="primary" onClick={submit} disabled={submitting}>
            {submitting ? "Saving…" : "Save & Show Root Cause"}
          </Button>
          <Button variant="secondary" onClick={onCancel} disabled={submitting}>
            Cancel
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="font-label mb-1 text-[10px] uppercase tracking-wider text-ink-faint">{label}</div>
      {children}
    </label>
  );
}

function NumberInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      inputMode="decimal"
      className="w-full rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm tabular-nums outline-none focus:border-ink/40"
    />
  );
}
