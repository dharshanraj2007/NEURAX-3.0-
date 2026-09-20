import React, { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  Siren,
  Thermometer,
  Gauge,
  Activity,
  Waves,
  Clock,
  Wallet,
  CheckCircle2,
  OctagonX,
  BellRing,
  ArrowUpRight,
  Package,
} from "lucide-react";
import { useAppData } from "@/context/AppDataContext";
import { MACHINE_STATUS_LABEL } from "@/lib/labels";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Badge, SeverityBadge } from "@/components/ui/Badge";
import { MachineStatusDot, SeverityDot } from "@/components/ui/StatusDot";
import { deviation, downtimeCost, formatCurrency, getParameterSeverity, severityRank } from "@/lib/calculations";
import type { MachineIncident, ParamKey, Severity } from "@/types";

const PARAM_ORDER: ParamKey[] = ["temperature", "pressure", "speed", "vibration"];
const PARAM_ICON: Record<ParamKey, React.ElementType> = {
  temperature: Thermometer,
  pressure: Gauge,
  speed: Activity,
  vibration: Waves,
};

export function MachineIncidents() {
  const [searchParams, setSearchParams] = useSearchParams();
  const machineId = searchParams.get("machine") ?? "M1";
  const setMachineId = (id: string) => setSearchParams({ machine: id });

  const {
    machines,
    standardValues,
    getReading,
    incidents,
    productDefects,
    acknowledgeIncident,
    stopMachineForIncident,
    notifyMaintenance,
    setIncidentCostPerMinute,
    machineName,
  } = useAppData();

  const machine = machines.find((m) => m.id === machineId) ?? machines[0];
  const reading = getReading(machine.id);

  const paramCards = useMemo(() => {
    if (!reading) return [];
    return PARAM_ORDER.map((key) => {
      const std = standardValues.find((s) => s.machineId === machine.id && s.parameter === key)!;
      const actual = reading[key];
      const severity = getParameterSeverity(actual, std.min, std.max);
      return { key, std, actual, severity };
    });
  }, [reading, standardValues, machine.id]);

  const conditionSeverity: Severity = paramCards.reduce<Severity>(
    (worst, p) => (severityRank(p.severity) > severityRank(worst) ? p.severity : worst),
    "normal"
  );

  const abnormalParams = paramCards.filter((p) => p.severity !== "normal");

  const activeIncident = useMemo(() => {
    const candidates = incidents.filter((i) => i.machineId === machine.id && i.date === "Today" && i.status !== "resolved");
    return [...candidates].sort((a, b) => severityRank(b.severity) - severityRank(a.severity))[0];
  }, [incidents, machine.id]);

  const affectedProducts = productDefects.filter((d) => d.machineId === machine.id);

  const activeEmergencies = useMemo(
    () =>
      [...incidents]
        .filter((i) => i.emergency && i.date === "Today" && i.status !== "resolved")
        .sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "critical" ? -1 : 1)),
    [incidents]
  );

  return (
    <div className="space-y-6">
      <div>
        <div className="font-label text-[11px] uppercase tracking-wider text-ink-faint">
          Abnormal Value → Emergency → Downtime → Cost
        </div>
        <h1 className="mt-1 text-3xl font-bold text-ink">Machine Incidents</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Detect abnormal machine conditions, escalate emergencies, and cost out the resulting downtime.
        </p>
      </div>

      {activeEmergencies.length > 0 && (
        <Card className="border-status-critical/30 bg-status-critical-bg/30">
          <CardBody className="space-y-2.5 p-4">
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-status-critical">
              <Siren className="h-3.5 w-3.5" />
              {activeEmergencies.length} Active Emergenc{activeEmergencies.length > 1 ? "ies" : "y"} · fetched live
            </div>
            <div className="flex flex-wrap gap-2">
              {activeEmergencies.map((e) => (
                <button
                  key={e.id}
                  onClick={() => setMachineId(e.machineId)}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
                    e.machineId === machine.id
                      ? "border-status-critical bg-surface shadow-card"
                      : "border-status-critical/30 bg-surface/60 hover:border-status-critical"
                  }`}
                >
                  <SeverityDot severity={e.severity} pulse />
                  <span className="font-semibold text-ink">{e.machineId}</span>
                  <span className="text-ink-muted">{e.label}</span>
                  <Badge tone={e.severity === "critical" ? "critical" : "warning"} className="ml-1">
                    {e.severity}
                  </Badge>
                </button>
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardBody className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <label className="font-label mb-2 block text-[10px] uppercase tracking-wider text-ink-faint">Select Machine</label>
            <Select value={machine.id} onChange={(e) => setMachineId(e.target.value)}>
              {machines.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.id} · {m.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex items-center gap-6">
            <div>
              <div className="font-label text-[10px] uppercase tracking-wider text-ink-faint">Condition</div>
              <div className="mt-1 flex items-center gap-2 text-lg font-bold text-ink">
                <SeverityDot severity={conditionSeverity} pulse />
                {conditionSeverity.toUpperCase()}
              </div>
            </div>
            <div>
              <div className="font-label text-[10px] uppercase tracking-wider text-ink-faint">Operational Status</div>
              <div className="mt-1">
                <Badge tone={machine.status === "running" ? "good" : machine.status === "warning" ? "warning" : "critical"}>
                  <MachineStatusDot status={machine.status} />
                  {MACHINE_STATUS_LABEL[machine.status]}
                </Badge>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-ink">Current Machine Values</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {paramCards.map(({ key, std, actual, severity }) => {
            const Icon = PARAM_ICON[key];
            return (
              <Card key={key} className={severity === "critical" ? "border-status-critical/50" : severity === "warning" ? "border-status-warning/50" : undefined}>
                <CardBody className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-semibold text-ink">
                      <Icon className="h-4 w-4 text-ink-faint" />
                      {std.label}
                    </div>
                    <SeverityBadge severity={severity} />
                  </div>
                  <div className="flex items-baseline justify-between text-xs text-ink-muted">
                    <span>Correct: {std.correctValue}{std.unit}</span>
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-2xl font-bold tabular-nums text-ink">{actual}</span>
                    <span className="text-sm text-ink-muted">{std.unit}</span>
                  </div>
                  <div className="text-[11px] text-ink-faint">Normal range {std.min}–{std.max}{std.unit}</div>
                </CardBody>
              </Card>
            );
          })}
        </div>
      </div>

      {abnormalParams.length > 0 && (
        <div className="space-y-3">
          {abnormalParams.map((p) => {
            const dev = deviation(p.actual, p.std.min, p.std.max);
            return (
              <Card key={p.key} className={p.severity === "critical" ? "border-status-critical/50 bg-status-critical-bg/30" : "border-status-warning/50 bg-status-warning-bg/30"}>
                <CardBody className="flex items-start gap-3">
                  <AlertTriangle className={p.severity === "critical" ? "h-5 w-5 shrink-0 text-status-critical" : "h-5 w-5 shrink-0 text-status-warning"} />
                  <div>
                    <div className="text-sm font-bold uppercase tracking-wide text-ink">
                      {dev.direction === "above" ? "High" : "Low"} {p.std.label} Detected
                    </div>
                    <div className="mt-1 text-xs text-ink-muted">
                      Expected: {p.std.min}–{p.std.max}{p.std.unit} &nbsp;·&nbsp; Actual: {p.actual}{p.std.unit} &nbsp;·&nbsp; Deviation: {dev.direction === "above" ? "+" : "-"}
                      {dev.amount}{p.std.unit} {dev.direction} {dev.direction === "above" ? "maximum" : "minimum"}
                    </div>
                  </div>
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}

      {activeIncident && activeIncident.emergency && (
        <EmergencyCard
          incident={activeIncident}
          machineName={machine.name}
          onAcknowledge={() => acknowledgeIncident(activeIncident.id)}
          onStop={() => stopMachineForIncident(activeIncident.id)}
          onNotify={() => notifyMaintenance(activeIncident.id)}
          onCostChange={(v) => setIncidentCostPerMinute(activeIncident.id, v)}
        />
      )}

      {affectedProducts.length > 0 && (
        <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="flex items-center gap-2 text-sm text-ink">
            <Package className="h-4 w-4 text-ink-faint" />
            <span className="font-semibold">{affectedProducts.length} affected product{affectedProducts.length > 1 ? "s" : ""}</span>
            <span className="text-ink-muted">traced to {machine.id}</span>
          </div>
          <Link
            to={`/product-defects?machine=${machine.id}`}
            className="flex items-center gap-1.5 text-sm font-semibold text-status-info hover:underline"
          >
            View Products <ArrowUpRight className="h-4 w-4" />
          </Link>
        </Card>
      )}

      <IncidentHistory key={machine.id} incidents={incidents} initialMachine={machine.id} machines={machines} machineName={machineName} />
    </div>
  );
}

function EmergencyCard({
  incident,
  machineName,
  onAcknowledge,
  onStop,
  onNotify,
  onCostChange,
}: {
  incident: MachineIncident;
  machineName: string;
  onAcknowledge: () => void;
  onStop: () => void;
  onNotify: () => void;
  onCostChange: (v: number) => void;
}) {
  const cost = downtimeCost(incident.downtimeMinutes, incident.costPerMinute);

  return (
    <Card className="animate-fade-in-scale border-2 border-status-critical bg-status-critical-bg/60 shadow-[0_0_0_4px_rgba(209,41,29,0.08)]">
      <CardBody className="space-y-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-status-critical text-white">
            <Siren className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <div className="text-xs font-bold uppercase tracking-wider text-status-critical">Emergency Incident</div>
            <div className="mt-0.5 text-lg font-bold text-ink">{incident.machineId} · {machineName}</div>
          </div>
          <SeverityBadge severity={incident.severity} />
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          <Field label="Issue" value={incident.label} />
          <Field label="Actual Value" value={`${incident.actualValue}${incident.unit}`} />
          <Field label="Safe Range" value={`${incident.expectedMin}–${incident.expectedMax}${incident.unit}`} />
          <Field label="Severity" value={incident.severity.toUpperCase()} />
        </div>

        <div className="rounded-lg border border-status-critical/30 bg-surface px-4 py-3">
          <div className="font-label text-[10px] uppercase tracking-wider text-ink-faint">Recommended Action</div>
          <div className="mt-0.5 text-sm font-semibold text-ink">{incident.recommendedAction}</div>
        </div>

        <div className="flex flex-wrap gap-2.5">
          <Button variant={incident.acknowledged ? "secondary" : "primary"} onClick={onAcknowledge} disabled={incident.acknowledged}>
            <CheckCircle2 className="h-4 w-4" />
            {incident.acknowledged ? "Acknowledged" : "Acknowledge Emergency"}
          </Button>
          <Button variant="danger" onClick={onStop} disabled={incident.status === "stopped"}>
            <OctagonX className="h-4 w-4" />
            {incident.status === "stopped" ? "Machine Stopped" : "Stop Machine"}
          </Button>
          <Button variant={incident.maintenanceNotified ? "secondary" : "primary"} onClick={onNotify} disabled={incident.maintenanceNotified}>
            <BellRing className="h-4 w-4" />
            {incident.maintenanceNotified ? "Maintenance Notified" : "Notify Maintenance"}
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-4 border-t border-status-critical/20 pt-4 sm:grid-cols-3">
          <Field label="Downtime Start" value={incident.downtimeStart ?? "—"} icon={Clock} />
          <Field label="Downtime End" value={incident.downtimeEnd ?? "Ongoing"} icon={Clock} />
          <Field label="Total Downtime" value={`${incident.downtimeMinutes} minutes`} icon={Clock} />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg bg-surface px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-ink-muted">
            Cost per minute
            <input
              type="number"
              value={incident.costPerMinute}
              onChange={(e) => onCostChange(Number(e.target.value) || 0)}
              className="w-20 rounded-md border border-border bg-bg px-2 py-1 text-sm font-semibold text-ink outline-none focus:border-ink/40"
            />
          </div>
          <div className="text-right">
            <div className="font-label flex items-center justify-end gap-1.5 text-[10px] uppercase tracking-wider text-status-critical">
              <Wallet className="h-3.5 w-3.5" /> Downtime Loss
            </div>
            <div className="text-2xl font-extrabold text-status-critical">{formatCurrency(cost)}</div>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

function Field({ label, value, icon: Icon }: { label: string; value: React.ReactNode; icon?: React.ElementType }) {
  return (
    <div>
      <div className="font-label flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-ink-faint">
        {Icon && <Icon className="h-3 w-3" />}
        {label}
      </div>
      <div className="mt-0.5 text-sm font-semibold text-ink">{value}</div>
    </div>
  );
}

function IncidentHistory({
  incidents,
  initialMachine,
  machines,
  machineName,
}: {
  incidents: MachineIncident[];
  initialMachine: string;
  machines: { id: string; name: string }[];
  machineName: (id: string) => string;
}) {
  const [machineFilter, setMachineFilter] = useState(initialMachine);
  const [severityFilter, setSeverityFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [paramFilter, setParamFilter] = useState("all");

  const filtered = incidents.filter(
    (i) =>
      (machineFilter === "all" || i.machineId === machineFilter) &&
      (severityFilter === "all" || i.severity === severityFilter) &&
      (dateFilter === "all" || i.date === dateFilter) &&
      (paramFilter === "all" || i.parameter === paramFilter)
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Machine Incident History</CardTitle>
      </CardHeader>
      <CardBody className="space-y-4 pt-3">
        <div className="flex flex-wrap gap-2.5">
          <Select value={machineFilter} onChange={(e) => setMachineFilter(e.target.value)}>
            <option value="all">All Machines</option>
            {machines.map((m) => (
              <option key={m.id} value={m.id}>{m.id}</option>
            ))}
          </Select>
          <Select value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)}>
            <option value="all">All Severities</option>
            <option value="critical">Critical</option>
            <option value="warning">Warning</option>
          </Select>
          <Select value={dateFilter} onChange={(e) => setDateFilter(e.target.value)}>
            <option value="all">All Dates</option>
            <option value="Today">Today</option>
            <option value="Yesterday">Yesterday</option>
          </Select>
          <Select value={paramFilter} onChange={(e) => setParamFilter(e.target.value)}>
            <option value="all">All Parameters</option>
            {PARAM_ORDER.map((p) => (
              <option key={p} value={p}>{p[0].toUpperCase() + p.slice(1)}</option>
            ))}
          </Select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                {["Date", "Machine", "Parameter", "Actual", "Severity", "Downtime", "Cost"].map((h) => (
                  <th key={h} className="font-label px-3 py-2 text-[10px] uppercase tracking-wider text-ink-faint">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((i) => (
                <tr key={i.id} className="border-b border-border/70 last:border-0">
                  <td className="px-3 py-3 text-ink-muted">{i.date}</td>
                  <td className="px-3 py-3 font-semibold text-ink">{i.machineId} <span className="font-normal text-ink-muted">· {machineName(i.machineId)}</span></td>
                  <td className="px-3 py-3 text-ink-muted">{i.label}</td>
                  <td className="px-3 py-3 tabular-nums text-ink">{i.actualValue}{i.unit}</td>
                  <td className="px-3 py-3"><SeverityBadge severity={i.severity} /></td>
                  <td className="px-3 py-3 tabular-nums text-ink-muted">{i.downtimeMinutes} min</td>
                  <td className="px-3 py-3 tabular-nums font-semibold text-ink">{formatCurrency(downtimeCost(i.downtimeMinutes, i.costPerMinute))}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-sm text-ink-faint">No incidents match these filters.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardBody>
    </Card>
  );
}
