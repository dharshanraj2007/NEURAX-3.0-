import React from "react";
import { cn } from "@/lib/utils";
import type { MachineStatus, Severity } from "@/types";

const STATUS_COLOR: Record<MachineStatus, string> = {
  running: "bg-status-good",
  warning: "bg-status-warning",
  down: "bg-status-critical",
};

const SEVERITY_COLOR: Record<Severity, string> = {
  normal: "bg-status-good",
  warning: "bg-status-warning",
  critical: "bg-status-critical",
};

export function MachineStatusDot({ status, pulse = false }: { status: MachineStatus; pulse?: boolean }) {
  return (
    <span className={cn("inline-block h-2 w-2 rounded-full", STATUS_COLOR[status], pulse && status !== "running" && "animate-pulse-ring")} />
  );
}

export function SeverityDot({ severity, pulse = false }: { severity: Severity; pulse?: boolean }) {
  return (
    <span
      className={cn(
        "inline-block h-2 w-2 rounded-full",
        SEVERITY_COLOR[severity],
        pulse && severity !== "normal" && "animate-pulse-ring"
      )}
    />
  );
}
