import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as ort from "onnxruntime-node";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ARTIFACT_DIR = path.join(__dirname, "..", "..", "ml", "artifacts");
const ONNX_PATH = path.join(ARTIFACT_DIR, "model.onnx");
const CARD_PATH = path.join(ARTIFACT_DIR, "model_card.json");
const METRICS_PATH = path.join(ARTIFACT_DIR, "metrics.json");
const HEATMAPS_PATH = path.join(ARTIFACT_DIR, "heatmaps.json");
const DATASET_DIR = path.join(__dirname, "..", "..", "train", "train");

interface ModelCard {
  class_names: string[];
  acceptable_class: string;
  input_size: number;
  input_channels: number;
  normalize_mean: number;
  normalize_std: number;
  feature_map_size: number;
  feature_channels: number;
  classifier_weight: number[][]; // [numClasses, featureChannels]
  classifier_bias: number[];
  architecture: string;
  cam_method: string;
}

// Confidence-threshold heuristics layered on top of the real softmax
// output. This is engineering judgement on a real distribution, not a
// separately trained out-of-distribution detector -- documented as such
// everywhere it's surfaced.
const LOW_CONFIDENCE_THRESHOLD = 0.5;
const MARGIN_THRESHOLD = 0.15;

let session: ort.InferenceSession | null = null;
let card: ModelCard | null = null;
let loadError: string | null = null;

export function isModelReady(): boolean {
  return session !== null && card !== null;
}

export function getLoadError(): string | null {
  return loadError;
}

export async function loadModel(): Promise<void> {
  try {
    if (!fs.existsSync(ONNX_PATH) || !fs.existsSync(CARD_PATH)) {
      loadError = "Model artifacts not found yet (ml/artifacts/model.onnx or model_card.json missing) -- training may still be running.";
      return;
    }
    card = JSON.parse(fs.readFileSync(CARD_PATH, "utf-8"));
    session = await ort.InferenceSession.create(ONNX_PATH);
    loadError = null;
    console.log("[vision] model loaded:", card!.class_names.join(", "));
  } catch (e) {
    loadError = e instanceof Error ? e.message : String(e);
    console.error("[vision] failed to load model:", loadError);
  }
}

export function getAggregateHeatmap(): unknown {
  if (!fs.existsSync(HEATMAPS_PATH)) return null;
  return JSON.parse(fs.readFileSync(HEATMAPS_PATH, "utf-8"));
}

/** Only real dataset paths matching <class>/<filename>.png are servable -- rejects traversal attempts. */
const SAMPLE_PATH_RE = /^(crack|hole|normal|rust|scratch)\/[A-Za-z0-9_.-]+\.png$/;

export function readSampleImage(relPath: string): Buffer | null {
  if (!SAMPLE_PATH_RE.test(relPath)) return null;
  const fullPath = path.join(DATASET_DIR, relPath);
  const resolved = path.resolve(fullPath);
  if (!resolved.startsWith(path.resolve(DATASET_DIR) + path.sep)) return null; // defense in depth
  if (!fs.existsSync(resolved)) return null;
  return fs.readFileSync(resolved);
}

export function getModelInfo() {
  const hasMetrics = fs.existsSync(METRICS_PATH);
  return {
    ready: isModelReady(),
    loadError: getLoadError(),
    modelCard: card,
    metrics: hasMetrics ? JSON.parse(fs.readFileSync(METRICS_PATH, "utf-8")) : null,
    metricsAvailable: hasMetrics,
  };
}

function softmax(logits: Float32Array): number[] {
  const max = Math.max(...logits);
  const exps = Array.from(logits, (v) => Math.exp(v - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((v) => v / sum);
}

export interface InferenceResult {
  qualityStatus: "ACCEPTABLE" | "DEFECTIVE" | "UNCERTAIN" | "POTENTIALLY_NOVEL";
  defectClass: string; // predicted class name, or "none" if acceptable
  confidence: number;
  probabilities: Record<string, number>;
  uncertaintyState: "confident" | "uncertain" | "potentially_novel";
  uncertaintyReason: string;
  heatmapDataUrl: string;
  originalDataUrl: string;
  camMethod: string;
}

/** Real inference: preprocess -> ONNX forward pass -> softmax -> CAM. No hardcoded outputs. */
export async function analyzeImage(buffer: Buffer): Promise<InferenceResult> {
  if (!session || !card) {
    throw new Error(getLoadError() ?? "Model not loaded");
  }
  const size = card.input_size;

  // Preprocess exactly as in training: grayscale, resize, normalize with the
  // real training-set mean/std stored in model_card.json.
  const { data: raw } = await sharp(buffer)
    .grayscale()
    .resize(size, size, { fit: "fill" })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const floatData = new Float32Array(size * size);
  for (let i = 0; i < raw.length; i++) {
    const pixel = raw[i] / 255;
    floatData[i] = (pixel - card.normalize_mean) / card.normalize_std;
  }

  const inputTensor = new ort.Tensor("float32", floatData, [1, 1, size, size]);
  const output = await session.run({ input: inputTensor });
  const logits = output.logits.data as Float32Array;
  const features = output.features.data as Float32Array; // [1, C, H, W] flattened

  const probs = softmax(logits);
  const classNames = card.class_names;
  const probabilities: Record<string, number> = {};
  classNames.forEach((name, i) => (probabilities[name] = probs[i]));

  const sorted = probs.map((p, i) => ({ p, i })).sort((a, b) => b.p - a.p);
  const top1 = sorted[0];
  const top2 = sorted[1];
  const predictedIdx = top1.i;
  const predictedClass = classNames[predictedIdx];
  const confidence = top1.p;
  const margin = top1.p - top2.p;

  let uncertaintyState: InferenceResult["uncertaintyState"] = "confident";
  let uncertaintyReason = `Top prediction confidence ${(confidence * 100).toFixed(1)}%, margin over runner-up ${(margin * 100).toFixed(1)} pts -- above both thresholds.`;
  if (confidence < LOW_CONFIDENCE_THRESHOLD) {
    uncertaintyState = "potentially_novel";
    uncertaintyReason = `Top prediction confidence ${(confidence * 100).toFixed(1)}% is below the ${(LOW_CONFIDENCE_THRESHOLD * 100).toFixed(0)}% threshold -- the model has no class it is confident matches this image; it may show a pattern outside the 5 trained classes.`;
  } else if (margin < MARGIN_THRESHOLD) {
    uncertaintyState = "uncertain";
    uncertaintyReason = `Top two classes (${classNames[top1.i]} ${(top1.p * 100).toFixed(1)}% vs ${classNames[top2.i]} ${(top2.p * 100).toFixed(1)}%) are within ${(MARGIN_THRESHOLD * 100).toFixed(0)} points of each other -- ambiguous call.`;
  }

  let qualityStatus: InferenceResult["qualityStatus"];
  if (uncertaintyState === "potentially_novel") qualityStatus = "POTENTIALLY_NOVEL";
  else if (uncertaintyState === "uncertain") qualityStatus = "UNCERTAIN";
  else qualityStatus = predictedClass === card.acceptable_class ? "ACCEPTABLE" : "DEFECTIVE";

  const defectClass = predictedClass === card.acceptable_class ? "none" : predictedClass;

  // Class Activation Mapping: weighted sum of the last-conv feature maps
  // using the predicted class's row of the trained classifier's weight
  // matrix. Approximate, model-attribution-based visual evidence -- NOT
  // ground-truth localization (no bounding boxes/masks exist in the data).
  const C = card.feature_channels;
  const H = card.feature_map_size;
  const W = card.feature_map_size;
  const weights = card.classifier_weight[predictedIdx];
  const cam = new Float32Array(H * W);
  for (let c = 0; c < C; c++) {
    const w = weights[c];
    const base = c * H * W;
    for (let p = 0; p < H * W; p++) {
      cam[p] += w * features[base + p];
    }
  }
  let camMax = -Infinity;
  for (let p = 0; p < cam.length; p++) {
    cam[p] = Math.max(0, cam[p]); // ReLU
    if (cam[p] > camMax) camMax = cam[p];
  }
  if (camMax <= 0) camMax = 1;
  const camBytes = Buffer.alloc(H * W);
  for (let p = 0; p < cam.length; p++) {
    camBytes[p] = Math.round((cam[p] / camMax) * 255);
  }

  const camSmall = sharp(camBytes, { raw: { width: W, height: H, channels: 1 } });
  const camUpscaled = await camSmall.resize(size, size, { kernel: "cubic" }).raw().toBuffer();

  // Red-intensity heatmap composited over the grayscale input.
  const heatmapRgba = Buffer.alloc(size * size * 4);
  for (let p = 0; p < size * size; p++) {
    const intensity = camUpscaled[p];
    heatmapRgba[p * 4 + 0] = 255;
    heatmapRgba[p * 4 + 1] = Math.max(0, 255 - intensity);
    heatmapRgba[p * 4 + 2] = Math.max(0, 255 - intensity);
    heatmapRgba[p * 4 + 3] = Math.round(intensity * 0.65);
  }

  const grayBase = await sharp(buffer).grayscale().resize(size, size, { fit: "fill" }).ensureAlpha().png().toBuffer();
  const overlay = await sharp(grayBase)
    .composite([{ input: heatmapRgba, raw: { width: size, height: size, channels: 4 }, blend: "over" }])
    .png()
    .toBuffer();

  const originalDataUrl = `data:image/png;base64,${grayBase.toString("base64")}`;
  const heatmapDataUrl = `data:image/png;base64,${overlay.toString("base64")}`;

  return {
    qualityStatus,
    defectClass,
    confidence,
    probabilities,
    uncertaintyState,
    uncertaintyReason,
    heatmapDataUrl,
    originalDataUrl,
    camMethod: card.cam_method,
  };
}
