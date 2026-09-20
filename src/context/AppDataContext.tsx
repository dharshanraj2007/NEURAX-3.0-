import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type {
  Bootstrap,
  CostConfig,
  HeatmapCell,
  Machine,
  MachineIncident,
  MachineReading,
  ManualDefectInput,
  ModelMetrics,
  ParamKey,
  ProductDefect,
  ProductionPoint,
  DefectDistributionEntry,
  StandardValue,
} from "@/types";
import { api } from "@/lib/api";
import { defectProductLoss, downtimeCost, isConfirmedDefect } from "@/lib/calculations";

interface Totals {
  totalDowntimeMinutes: number;
  totalDowntimeCost: number;
  downtimeMachineCount: number;
  totalProductLoss: number;
  totalEconomicLoss: number;
  activeMachines: number;
  totalMachines: number;
  emergencyCount: number;
  criticalEmergencyCount: number;
  warningEmergencyCount: number;
  totalProduction: number;
  totalGood: number;
  totalDefective: number;
  pendingReviewCount: number;
  pendingReviewPotentialLoss: number;
}

export interface HeatmapRow {
  machineId: string;
  cells: HeatmapCell[];
}

interface AppDataContextValue {
  machines: Machine[];
  readings: MachineReading[];
  standardValues: StandardValue[];
  incidents: MachineIncident[];
  productDefects: ProductDefect[];
  costConfig: CostConfig;
  production: { trend: ProductionPoint[]; defectDistribution: DefectDistributionEntry[] };
  modelMetrics: ModelMetrics;
  heatmap: { hours: string[]; rows: HeatmapRow[] };
  totals: Totals;
  machineLossById: Record<string, number>;

  machineName: (machineId: string) => string;
  getStandardValue: (machineId: string, parameter: ParamKey | "thickness") => StandardValue | undefined;
  getReading: (machineId: string) => MachineReading | undefined;
  updateStandardValue: (
    machineId: string,
    parameter: ParamKey | "thickness",
    patch: Partial<Pick<StandardValue, "correctValue" | "min" | "max" | "unit">>
  ) => Promise<void>;

  acknowledgeIncident: (id: string) => Promise<void>;
  stopMachineForIncident: (id: string) => Promise<void>;
  notifyMaintenance: (id: string) => Promise<void>;
  setIncidentCostPerMinute: (id: string, cost: number) => Promise<void>;
  reviewProductDefect: (productId: string, decision: "approved" | "rejected") => Promise<void>;
  addProductDefect: (input: ManualDefectInput) => Promise<ProductDefect>;
}

const AppDataContext = createContext<AppDataContextValue | null>(null);

export function AppDataProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<Bootstrap | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    api
      .bootstrap()
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load data"));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const machines = data?.machines ?? [];
  const readings = data?.readings ?? [];
  const standardValues = data?.standardValues ?? [];
  const incidents = data?.incidents ?? [];
  const productDefects = data?.productDefects ?? [];
  const costConfig = data?.costConfig ?? { downtimeCostPerMinute: 250, manufacturingCostPerUnit: 400, reworkCostPerUnit: 250 };
  const production = data?.production ?? { trend: [], defectDistribution: [] };
  const modelMetrics = data?.modelMetrics ?? { classMetrics: [], confusionLabels: [], confusionMatrix: [], robustnessConditions: [], farFrrCurve: [] };

  const heatmap = useMemo(() => {
    if (!data) return { hours: [] as string[], rows: [] as HeatmapRow[] };
    const rows = machines.map((m) => ({ machineId: m.id, cells: data.heatmap.rows[m.id] ?? [] }));
    return { hours: data.heatmap.hours, rows };
  }, [data, machines]);

  const machineName = useCallback((machineId: string) => machines.find((m) => m.id === machineId)?.name ?? machineId, [machines]);

  const getStandardValue = useCallback(
    (machineId: string, parameter: ParamKey | "thickness") =>
      standardValues.find((s) => s.machineId === machineId && s.parameter === parameter),
    [standardValues]
  );

  const getReading = useCallback((machineId: string) => readings.find((r) => r.machineId === machineId), [readings]);

  const updateStandardValue: AppDataContextValue["updateStandardValue"] = useCallback(
    async (machineId, parameter, patch) => {
      const current = standardValues.find((s) => s.machineId === machineId && s.parameter === parameter);
      if (!current) return;
      const merged = { correctValue: current.correctValue, min: current.min, max: current.max, unit: current.unit, ...patch };
      const updated = await api.updateStandardValue(machineId, parameter, merged);
      setData((prev) =>
        prev
          ? { ...prev, standardValues: prev.standardValues.map((s) => (s.machineId === machineId && s.parameter === parameter ? updated : s)) }
          : prev
      );
    },
    [standardValues]
  );

  const acknowledgeIncident = useCallback(async (id: string) => {
    const { incident } = await api.acknowledgeIncident(id);
    setData((prev) => (prev ? { ...prev, incidents: prev.incidents.map((i) => (i.id === id ? incident : i)) } : prev));
  }, []);

  const notifyMaintenance = useCallback(async (id: string) => {
    const { incident } = await api.notifyMaintenance(id);
    setData((prev) => (prev ? { ...prev, incidents: prev.incidents.map((i) => (i.id === id ? incident : i)) } : prev));
  }, []);

  const stopMachineForIncident = useCallback(async (id: string) => {
    const { incident, machine } = await api.stopIncident(id);
    setData((prev) =>
      prev
        ? {
            ...prev,
            incidents: prev.incidents.map((i) => (i.id === id ? incident : i)),
            machines: prev.machines.map((m) => (m.id === machine.id ? { ...m, status: machine.status as Machine["status"] } : m)),
          }
        : prev
    );
  }, []);

  const setIncidentCostPerMinute = useCallback(async (id: string, cost: number) => {
    const { incident } = await api.setIncidentCostPerMinute(id, cost);
    setData((prev) => (prev ? { ...prev, incidents: prev.incidents.map((i) => (i.id === id ? incident : i)) } : prev));
  }, []);

  const reviewProductDefect = useCallback(async (productId: string, decision: "approved" | "rejected") => {
    const updated = await api.reviewProductDefect(productId, decision);
    setData((prev) => (prev ? { ...prev, productDefects: prev.productDefects.map((d) => (d.productId === productId ? updated : d)) } : prev));
  }, []);

  const addProductDefect = useCallback(async (input: ManualDefectInput) => {
    const created = await api.createProductDefect(input);
    setData((prev) => (prev ? { ...prev, productDefects: [...prev.productDefects, created] } : prev));
    return created;
  }, []);

  const machineLossById = useMemo(() => {
    const byMachine: Record<string, number> = {};
    for (const m of machines) byMachine[m.id] = 0;
    for (const incident of incidents) {
      if (incident.date !== "Today") continue;
      byMachine[incident.machineId] = (byMachine[incident.machineId] ?? 0) + downtimeCost(incident.downtimeMinutes, incident.costPerMinute);
    }
    for (const defect of productDefects) {
      if (!isConfirmedDefect(defect.reviewStatus)) continue;
      const { total } = defectProductLoss(defect, costConfig.reworkCostPerUnit, costConfig.manufacturingCostPerUnit);
      byMachine[defect.machineId] = (byMachine[defect.machineId] ?? 0) + total;
    }
    return byMachine;
  }, [incidents, machines, productDefects, costConfig]);

  const totals = useMemo<Totals>(() => {
    const todayIncidents = incidents.filter((i) => i.date === "Today");
    const totalDowntimeMinutes = todayIncidents.reduce((sum, i) => sum + i.downtimeMinutes, 0);
    const totalDowntimeCost = todayIncidents.reduce((sum, i) => sum + downtimeCost(i.downtimeMinutes, i.costPerMinute), 0);
    const downtimeMachineCount = new Set(todayIncidents.filter((i) => i.downtimeMinutes > 0).map((i) => i.machineId)).size;

    const totalProductLoss = productDefects.reduce((sum, d) => {
      if (!isConfirmedDefect(d.reviewStatus)) return sum;
      const { total } = defectProductLoss(d, costConfig.reworkCostPerUnit, costConfig.manufacturingCostPerUnit);
      return sum + total;
    }, 0);

    const pendingReview = productDefects.filter((d) => d.reviewStatus === "pending_review");
    const pendingReviewPotentialLoss = pendingReview.reduce((sum, d) => {
      const { total } = defectProductLoss(d, costConfig.reworkCostPerUnit, costConfig.manufacturingCostPerUnit);
      return sum + total;
    }, 0);

    const emergencies = todayIncidents.filter((i) => i.emergency && i.status !== "resolved");

    const totalProduction = production.trend.reduce((sum, p) => sum + p.production, 0);
    const totalGood = production.trend.reduce((sum, p) => sum + p.good, 0);
    const totalDefective = production.trend.reduce((sum, p) => sum + p.defective, 0);

    return {
      totalDowntimeMinutes,
      totalDowntimeCost,
      downtimeMachineCount,
      totalProductLoss,
      totalEconomicLoss: totalDowntimeCost + totalProductLoss,
      activeMachines: machines.filter((m) => m.status === "running").length,
      totalMachines: machines.length,
      emergencyCount: emergencies.length,
      criticalEmergencyCount: emergencies.filter((i) => i.severity === "critical").length,
      warningEmergencyCount: emergencies.filter((i) => i.severity === "warning").length,
      totalProduction,
      totalGood,
      totalDefective,
      pendingReviewCount: pendingReview.length,
      pendingReviewPotentialLoss,
    };
  }, [incidents, machines, productDefects, costConfig, production]);

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center bg-bg px-6">
        <div className="max-w-md rounded-card border border-status-critical/30 bg-surface p-6 text-center shadow-card">
          <div className="text-sm font-bold text-status-critical">Can&apos;t reach the API</div>
          <p className="mt-2 text-sm text-ink-muted">{error}</p>
          <p className="mt-3 text-xs text-ink-faint">
            Start the backend with <code className="rounded bg-bg px-1 py-0.5">npm run dev</code> inside <code className="rounded bg-bg px-1 py-0.5">server/</code>,
            then reload.
          </p>
          <button onClick={load} className="mt-4 rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-surface">
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex h-screen items-center justify-center bg-bg">
        <div className="text-sm font-medium text-ink-muted">Loading factory data…</div>
      </div>
    );
  }

  const value: AppDataContextValue = {
    machines,
    readings,
    standardValues,
    incidents,
    productDefects,
    costConfig,
    production,
    modelMetrics,
    heatmap,
    totals,
    machineLossById,
    machineName,
    getStandardValue,
    getReading,
    updateStandardValue,
    acknowledgeIncident,
    stopMachineForIncident,
    notifyMaintenance,
    setIncidentCostPerMinute,
    reviewProductDefect,
    addProductDefect,
  };

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData(): AppDataContextValue {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error("useAppData must be used within AppDataProvider");
  return ctx;
}
