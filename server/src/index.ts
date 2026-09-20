import "./env.js";
import express from "express";
import cors from "cors";
import multer from "multer";
import * as repo from "./repo.js";
import * as vision from "./vision.js";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const app = express();

// CORS_ORIGIN in .env can be one origin or a comma-separated list, for a
// pinned production frontend. Leave it unset for local dev: Vite's dev
// server picks whatever port is free (5173, 5174, ...), so instead of
// pinning to one we allow any localhost/127.0.0.1 origin. Requests with no
// Origin header (curl, server-to-server, same-origin via the Vite proxy)
// are always allowed.
const configuredOrigins = process.env.CORS_ORIGIN?.split(",").map((o) => o.trim()).filter(Boolean);
const isLocalDevOrigin = (origin: string) => /^https?:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (configuredOrigins?.length) return callback(null, configuredOrigins.includes(origin));
      callback(null, isLocalDevOrigin(origin));
    },
  })
);
app.use(express.json());

const PORT = Number(process.env.PORT) || 4000;

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.get("/api/bootstrap", (_req, res) => {
  res.json(repo.getBootstrap());
});

app.get("/api/machines", (_req, res) => res.json(repo.getMachines()));
app.get("/api/readings", (_req, res) => res.json(repo.getReadings()));
app.get("/api/standard-values", (_req, res) => res.json(repo.getStandardValues()));
app.get("/api/incidents", (_req, res) => res.json(repo.getIncidents()));
app.get("/api/product-defects", (_req, res) => res.json(repo.getProductDefects()));
app.get("/api/production", (_req, res) =>
  res.json({ trend: repo.getProductionTrend(), defectDistribution: repo.getDefectDistribution() })
);
app.get("/api/model-metrics", (_req, res) => res.json(repo.getModelMetrics()));
app.get("/api/heatmap", (_req, res) => res.json(repo.getHeatmap()));
app.get("/api/config", (_req, res) => res.json(repo.getCostConfig()));

app.patch("/api/standard-values/:machineId/:parameter", (req, res) => {
  const { machineId, parameter } = req.params;
  const { correctValue, min, max, unit } = req.body ?? {};
  if ([correctValue, min, max].some((v) => typeof v !== "number") || typeof unit !== "string") {
    return res.status(400).json({ error: "correctValue, min, max must be numbers and unit a string" });
  }
  const updated = repo.updateStandardValue(machineId, parameter, { correctValue, min, max, unit });
  if (!updated) return res.status(404).json({ error: "Standard value not found" });
  res.json(updated);
});

app.post("/api/incidents/:id/acknowledge", (req, res) => {
  const updated = repo.patchIncident(req.params.id, { acknowledged: true, status: "acknowledged" });
  if (!updated) return res.status(404).json({ error: "Incident not found" });
  res.json({ incident: updated });
});

app.post("/api/incidents/:id/notify-maintenance", (req, res) => {
  const updated = repo.patchIncident(req.params.id, { maintenanceNotified: true });
  if (!updated) return res.status(404).json({ error: "Incident not found" });
  res.json({ incident: updated });
});

app.post("/api/incidents/:id/stop", (req, res) => {
  const existing = repo.getIncidentById(req.params.id);
  if (!existing) return res.status(404).json({ error: "Incident not found" });
  const updated = repo.patchIncident(req.params.id, {
    status: "stopped",
    downtimeStart: existing.downtimeStart ?? "Just now",
  });
  repo.setMachineStatus(existing.machineId, "down");
  const machine = repo.getMachines().find((m) => m.id === existing.machineId);
  res.json({ incident: updated, machine });
});

app.post("/api/product-defects", (req, res) => {
  const b = req.body ?? {};
  const machine = repo.getMachines().find((m) => m.id === b.machineId);
  if (!machine) return res.status(400).json({ error: `Unknown machineId: ${b.machineId}` });

  const numericFields = ["targetValue", "actualValue", "reworkedQuantity", "scrappedQuantity"];
  for (const f of numericFields) {
    if (typeof b[f] !== "number" || Number.isNaN(b[f])) {
      return res.status(400).json({ error: `${f} must be a number` });
    }
  }
  const params = b.machineParametersAtProduction ?? {};
  for (const f of ["temperature", "pressure", "speed", "vibration"]) {
    if (typeof params[f] !== "number" || Number.isNaN(params[f])) {
      return res.status(400).json({ error: `machineParametersAtProduction.${f} must be a number` });
    }
  }
  if (typeof b.defectType !== "string" || !b.defectType.trim()) {
    return res.status(400).json({ error: "defectType is required" });
  }

  const created = repo.createProductDefect({
    machineId: b.machineId,
    defectType: b.defectType.trim(),
    targetValue: b.targetValue,
    actualValue: b.actualValue,
    unit: typeof b.unit === "string" && b.unit.trim() ? b.unit.trim() : "mm",
    reworkedQuantity: b.reworkedQuantity,
    scrappedQuantity: b.scrappedQuantity,
    location: typeof b.location === "string" && b.location.trim() ? b.location.trim() : "Not specified",
    machineParametersAtProduction: {
      temperature: params.temperature,
      pressure: params.pressure,
      speed: params.speed,
      vibration: params.vibration,
    },
  });
  res.status(201).json(created);
});

app.post("/api/product-defects/:productId/review", (req, res) => {
  const { decision } = req.body ?? {};
  if (decision !== "approved" && decision !== "rejected") {
    return res.status(400).json({ error: "decision must be 'approved' or 'rejected'" });
  }
  const updated = repo.setReviewStatus(req.params.productId, decision);
  if (!updated) return res.status(404).json({ error: "Product defect not found" });
  res.json(updated);
});

app.patch("/api/incidents/:id/cost-per-minute", (req, res) => {
  const { costPerMinute } = req.body ?? {};
  if (typeof costPerMinute !== "number") return res.status(400).json({ error: "costPerMinute must be a number" });
  const updated = repo.patchIncident(req.params.id, { costPerMinute });
  if (!updated) return res.status(404).json({ error: "Incident not found" });
  res.json({ incident: updated });
});

// ---------------------------------------------------------------------------
// Vision inference -- real model, real organizer-trained weights. See
// server/src/vision.ts and ml/train.py. Everything here operates on
// ml/artifacts/{model.onnx,model_card.json,metrics.json}; nothing is
// hardcoded or mocked.
// ---------------------------------------------------------------------------
app.get("/api/vision/model-info", async (_req, res) => {
  if (!vision.isModelReady()) await vision.loadModel(); // retry: training may have finished since last check
  res.json(vision.getModelInfo());
});

app.post("/api/vision/analyze", upload.single("image"), async (req, res) => {
  if (!vision.isModelReady()) await vision.loadModel();
  if (!vision.isModelReady()) {
    return res.status(503).json({ error: vision.getLoadError() ?? "Model not ready" });
  }
  if (!req.file) {
    return res.status(400).json({ error: "No image uploaded (field name 'image')" });
  }
  try {
    const result = await vision.analyzeImage(req.file.buffer);
    res.json(result);
  } catch (e) {
    console.error("[vision] inference error:", e);
    res.status(422).json({ error: e instanceof Error ? e.message : "Inference failed -- check the file is a valid image" });
  }
});

app.get("/api/vision/heatmap", (_req, res) => {
  const data = vision.getAggregateHeatmap();
  if (!data) {
    return res.status(404).json({ error: "Aggregate heatmap not generated yet -- run ml/aggregate_heatmaps.py" });
  }
  res.json(data);
});

app.get("/api/vision/sample-image", (req, res) => {
  const relPath = String(req.query.path ?? "");
  const buffer = vision.readSampleImage(relPath);
  if (!buffer) return res.status(404).json({ error: "Unknown or invalid dataset image path" });
  res.setHeader("Content-Type", "image/png");
  res.send(buffer);
});

app.get("/api/vision/analyze-sample", async (req, res) => {
  if (!vision.isModelReady()) await vision.loadModel();
  if (!vision.isModelReady()) {
    return res.status(503).json({ error: vision.getLoadError() ?? "Model not ready" });
  }
  const relPath = String(req.query.path ?? "");
  const buffer = vision.readSampleImage(relPath);
  if (!buffer) return res.status(404).json({ error: "Unknown or invalid dataset image path" });
  try {
    const result = await vision.analyzeImage(buffer);
    res.json(result);
  } catch (e) {
    console.error("[vision] sample inference error:", e);
    res.status(422).json({ error: e instanceof Error ? e.message : "Inference failed" });
  }
});

app.listen(PORT, () => {
  console.log(`[server] INSPECT-QC API listening on http://localhost:${PORT}`);
  vision.loadModel().then(() => {
    if (!vision.isModelReady()) {
      console.warn("[vision]", vision.getLoadError());
    }
  });
});
