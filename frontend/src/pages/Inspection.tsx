import { useEffect, useRef, useState } from "react";
import { api, ApiError } from "../api/client";
import type { DataHealthResponse, InspectionResult } from "../api/types";
import { Card } from "../components/Card";
import { Badge } from "../components/Badge";
import { PageHeader } from "../components/PageHeader";
import { BoundingBoxOverlay } from "../components/BoundingBoxOverlay";
import { ErrorState } from "../components/LoadingState";
import { useApi } from "../hooks/useApi";

const VERDICT_TONE = { acceptable: "good", defective: "critical", uncertain: "warning" } as const;

export function Inspection() {
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<InspectionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modelReady, setModelReady] = useState<boolean | null>(null);
  const health = useApi<DataHealthResponse>(() => api.get("/api/data/health"));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api
      .get<{ model_ready: boolean }>("/api/vision/status")
      .then((r) => setModelReady(r.model_ready))
      .catch(() => setModelReady(false));
  }, []);

  const handleFile = async (file: File) => {
    setPreview(URL.createObjectURL(file));
    setResult(null);
    setError(null);
    setLoading(true);
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await api.postForm<InspectionResult>("/api/vision/inspect", form);
      setResult(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-8">
      <PageHeader
        eyebrow="InspectIQ / Quality Workstation"
        title="Defect Inspection"
        description="Runs a real forward pass through the trained YOLOv8 detector (fine-tuned on the real NEU-DET steel surface-defect dataset). Every box, class and confidence below comes directly from that inference call - never a canned response."
      />

      {modelReady === false && <VisionReadinessPanel sources={health.data?.sources} />}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Upload a part image">
          <div
            className="flex h-56 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-white/15 text-center hover:border-[var(--series-1)]"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const file = e.dataTransfer.files?.[0];
              if (file) handleFile(file);
            }}
          >
            <p className="text-sm text-[var(--text-secondary)]">Drop an image, or click to browse</p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">JPG/PNG - steel surface / metal part photos work best</p>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
            />
          </div>
          <p className="mt-3 text-xs text-[var(--text-muted)]">
            No sample images shipped here to avoid implying results are canned - use any of the real NEU-DET
            validation images at <code className="rounded bg-[var(--surface-2)] px-1 py-0.5">data/raw/NEU-DET-split/val/images</code> for a
            quick real test.
          </p>
        </Card>

        <Card title="Result">
          {loading && <p className="text-sm text-[var(--text-muted)]">Running inference...</p>}
          {error && <ErrorState message={error} />}
          {!loading && !error && preview && result && (
            <div className="space-y-4">
              <BoundingBoxOverlay
                imageUrl={preview}
                detections={result.detections}
                imgW={result.image_width}
                imgH={result.image_height}
              />
              <div className="flex items-center justify-between">
                <Badge tone={VERDICT_TONE[result.verdict]}>{result.verdict.toUpperCase()}</Badge>
                <span className="text-xs text-[var(--text-muted)]">
                  Uncertain threshold (raw conf): {result.uncertain_threshold_raw_confidence.toFixed(2)}
                </span>
              </div>
              <DetectionTable detections={result.detections} />
            </div>
          )}
          {!loading && !preview && <p className="text-sm text-[var(--text-muted)]">Upload an image to see live results.</p>}
        </Card>
      </div>
    </div>
  );
}

const READINESS_ROWS: { id: string; label: string }[] = [
  { id: "neu-det", label: "Dataset (NEU-DET)" },
  { id: "yolo-weights", label: "Detector" },
  { id: "calibration", label: "Calibration" },
];

// The professional "not ready" state the very first design pass on this
// project called for: never a fake detection, always an honest breakdown of
// exactly which real artifact is missing - sourced from /api/data/health,
// the same live filesystem check the Data page uses, not a guess.
function VisionReadinessPanel({ sources }: { sources: DataHealthResponse["sources"] | undefined }) {
  const lookup = new Map((sources ?? []).map((s) => [s.id, s]));
  const inferenceReady = READINESS_ROWS.every((r) => lookup.get(r.id)?.ready);

  return (
    <div className="rounded-lg border border-[var(--status-warning)]/30 bg-[var(--surface-1)] p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-[var(--text-primary)]">Vision Model</p>
        <Badge tone={inferenceReady ? "good" : "warning"}>{inferenceReady ? "READY" : "NOT READY"}</Badge>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {READINESS_ROWS.map((row) => {
          const src = lookup.get(row.id);
          const ready = src?.ready ?? false;
          return (
            <div key={row.id} className="rounded-md bg-[var(--surface-2)] px-3 py-2.5">
              <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--text-muted)]">{row.label}</p>
              <p
                className="mt-1 text-sm font-semibold"
                style={{ color: ready ? "var(--status-good)" : "var(--status-warning)" }}
              >
                {sources === undefined ? "..." : ready ? "READY" : "NOT READY"}
              </p>
            </div>
          );
        })}
        <div className="rounded-md bg-[var(--surface-2)] px-3 py-2.5">
          <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--text-muted)]">Inference</p>
          <p className="mt-1 text-sm font-semibold" style={{ color: inferenceReady ? "var(--status-good)" : "var(--status-critical)" }}>
            {sources === undefined ? "..." : inferenceReady ? "AVAILABLE" : "UNAVAILABLE"}
          </p>
        </div>
      </div>
      <p className="mt-4 text-xs leading-relaxed text-[var(--text-muted)]">
        No fake result is shown while any of the above is not ready. Once <code className="rounded bg-[var(--surface-2)] px-1 py-0.5">ml/train_detector.py</code> and{" "}
        <code className="rounded bg-[var(--surface-2)] px-1 py-0.5">ml/calibrate.py</code> finish, this panel and the upload zone below update automatically
        on the next check - no restart, no code change.
      </p>
    </div>
  );
}

function DetectionTable({ detections }: { detections: InspectionResult["detections"] }) {
  if (detections.length === 0) {
    return <p className="text-sm text-[var(--text-muted)]">No defects detected above the confidence floor.</p>;
  }
  return (
    <table className="w-full text-left text-sm">
      <thead className="text-xs uppercase text-[var(--text-muted)]">
        <tr>
          <th className="pb-2 pr-4">Class</th>
          <th className="pb-2 pr-4">Raw conf.</th>
          <th className="pb-2 pr-4">Calibrated</th>
          <th className="pb-2">Status</th>
        </tr>
      </thead>
      <tbody className="tabular-nums text-[var(--text-secondary)]">
        {detections.map((d, i) => (
          <tr key={i} className="border-t border-white/5">
            <td className="py-1.5 pr-4 text-[var(--text-primary)]">{d.class_name}</td>
            <td className="py-1.5 pr-4">{(d.raw_confidence * 100).toFixed(1)}%</td>
            <td className="py-1.5 pr-4">{(d.calibrated_confidence * 100).toFixed(1)}%</td>
            <td className="py-1.5">
              <Badge tone={d.uncertain ? "warning" : "good"}>{d.uncertain ? "uncertain" : "confident"}</Badge>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
