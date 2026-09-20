import type { AggregateHeatmap, Bootstrap, ManualDefectInput, MachineIncident, ModelInfo, ProductDefect, StandardValue, VisionResult } from "@/types";

// In dev this stays empty and requests go through the Vite proxy (see
// vite.config.ts) to the backend on :4000. Set VITE_API_BASE_URL in .env
// to point at a backend that isn't proxied (e.g. a separate deployment).
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const isFormData = init?.body instanceof FormData;
  const res = await fetch(`${API_BASE}/api${path}`, {
    headers: isFormData ? undefined : { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  bootstrap: () => request<Bootstrap>("/bootstrap"),

  updateStandardValue: (
    machineId: string,
    parameter: string,
    patch: Pick<StandardValue, "correctValue" | "min" | "max" | "unit">
  ) =>
    request<StandardValue>(`/standard-values/${machineId}/${parameter}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),

  acknowledgeIncident: (id: string) =>
    request<{ incident: MachineIncident }>(`/incidents/${id}/acknowledge`, { method: "POST" }),

  notifyMaintenance: (id: string) =>
    request<{ incident: MachineIncident }>(`/incidents/${id}/notify-maintenance`, { method: "POST" }),

  stopIncident: (id: string) =>
    request<{ incident: MachineIncident; machine: { id: string; name: string; status: string } }>(`/incidents/${id}/stop`, {
      method: "POST",
    }),

  setIncidentCostPerMinute: (id: string, costPerMinute: number) =>
    request<{ incident: MachineIncident }>(`/incidents/${id}/cost-per-minute`, {
      method: "PATCH",
      body: JSON.stringify({ costPerMinute }),
    }),

  reviewProductDefect: (productId: string, decision: "approved" | "rejected") =>
    request<ProductDefect>(`/product-defects/${productId}/review`, {
      method: "POST",
      body: JSON.stringify({ decision }),
    }),

  createProductDefect: (input: ManualDefectInput) =>
    request<ProductDefect>("/product-defects", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  visionModelInfo: () => request<ModelInfo>("/vision/model-info"),

  analyzeImage: (file: File) => {
    const form = new FormData();
    form.append("image", file);
    return request<VisionResult>("/vision/analyze", { method: "POST", body: form });
  },

  visionHeatmap: () => request<AggregateHeatmap>("/vision/heatmap"),

  sampleImageUrl: (relPath: string) => `${API_BASE}/api/vision/sample-image?path=${encodeURIComponent(relPath)}`,

  analyzeSample: (relPath: string) => request<VisionResult>(`/vision/analyze-sample?path=${encodeURIComponent(relPath)}`),
};
